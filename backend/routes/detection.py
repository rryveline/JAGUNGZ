"""Detection API: validate an upload, run YOLO26, return boxes and an annotated image."""

from __future__ import annotations

import base64
import logging
import shutil
import tempfile
import threading
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from backend.core.config import settings
from backend.services.image_processing import ImageRejected, decode_image, render_annotated_jpeg
from backend.services.inference import (
    InferenceUnavailable,
    get_inference_service,
    validate_confidence_threshold,
)
from backend.services.model_comparison import compare_models, models_status
from backend.services.video_processing import (
    VideoRejected,
    analyze_video_file,
    validate_video_signature,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_video_jobs: dict[str, dict] = {}
_video_jobs_lock = threading.Lock()


def _error(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"success": False, "message": message})


async def _read_limited(upload: UploadFile) -> bytes:
    limit = settings.max_upload_bytes
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await upload.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > limit:
            raise ImageRejected(
                f"The file exceeds the upload limit of {max(1, limit // (1024 * 1024))} MB.",
                status_code=413,
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.get("/status")
def status() -> dict:
    return get_inference_service().status()


@router.get("/models/status")
def get_models_status() -> dict:
    return models_status()


@router.post("/detect/compare")
async def detect_compare(
    file: UploadFile | None = File(default=None),
    confidence_threshold: float | None = Form(default=None),
) -> JSONResponse:
    try:
        conf = validate_confidence_threshold(confidence_threshold)
    except ValueError as exc:
        return _error(400, str(exc))

    if file is None:
        return _error(400, "No file is selected.")

    try:
        raw = await _read_limited(file)
    except ImageRejected as exc:
        return _error(exc.status_code, str(exc))
    finally:
        await file.close()

    if not raw:
        return _error(400, "The file is corrupted or cannot be read.")

    try:
        image = decode_image(raw)
    except ImageRejected as exc:
        return _error(exc.status_code, str(exc))

    result = compare_models(image, confidence_threshold=conf)
    return JSONResponse(status_code=result.get("status", 200), content=result)


@router.post("/detect")
async def detect(
    file: UploadFile | None = File(default=None),
    confidence_threshold: float | None = Form(default=None),
) -> JSONResponse:
    try:
        conf = validate_confidence_threshold(confidence_threshold)
    except ValueError as exc:
        return _error(400, str(exc))

    if file is None:
        return _error(400, "No file is selected.")

    try:
        raw = await _read_limited(file)
    except ImageRejected as exc:
        return _error(exc.status_code, str(exc))
    finally:
        await file.close()

    if not raw:
        return _error(400, "The file is corrupted or cannot be read.")

    try:
        image = decode_image(raw)
    except ImageRejected as exc:
        return _error(exc.status_code, str(exc))

    service = get_inference_service()
    try:
        detections = service.predict(image, confidence_threshold=conf)
    except InferenceUnavailable as exc:
        return _error(503, str(exc))
    except Exception:
        logger.exception("YOLO inference failed")
        return _error(500, "Unable to process the uploaded image.")

    try:
        annotated = render_annotated_jpeg(image, detections)
    except Exception:
        logger.exception("Failed to render the annotated image")
        return _error(500, "Unable to process the uploaded image.")

    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "confidence_threshold": conf,
            "total_detections": len(detections),
            "detections": [item.to_dict() for item in detections],
            "annotated_image": base64.b64encode(annotated).decode("ascii"),
            "annotated_mime": "image/jpeg",
        },
    )


@router.post("/detect/frame")
async def detect_frame(
    file: UploadFile | None = File(default=None),
    confidence_threshold: float | None = Form(default=None),
) -> JSONResponse:
    try:
        conf = validate_confidence_threshold(confidence_threshold)
    except ValueError as exc:
        return _error(400, str(exc))

    if file is None:
        return _error(400, "No frame is selected.")

    try:
        raw = await _read_limited(file)
    except ImageRejected as exc:
        return _error(exc.status_code, str(exc))
    finally:
        await file.close()

    if not raw:
        return _error(400, "The frame is empty or cannot be read.")

    try:
        image = decode_image(raw)
    except ImageRejected as exc:
        return _error(exc.status_code, str(exc))

    service = get_inference_service()
    t0 = time.perf_counter()
    try:
        detections = service.predict(image, confidence_threshold=conf)
    except InferenceUnavailable as exc:
        return _error(503, str(exc))
    except Exception:
        logger.exception("YOLO frame inference failed")
        return _error(500, "Unable to process the camera frame.")

    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "detection_method": "camera",
            "confidence_threshold": conf,
            "frame_width": image.width,
            "frame_height": image.height,
            "inference_ms": round((time.perf_counter() - t0) * 1000.0, 1),
            "total_detections": len(detections),
            "detections": [item.to_dict() for item in detections],
        },
    )


@router.post("/detect/video")
async def detect_video(
    file: UploadFile | None = File(default=None),
    confidence_threshold: float | None = Form(default=None),
    sample_interval_sec: float | None = Form(default=None),
) -> JSONResponse:
    try:
        conf = validate_confidence_threshold(confidence_threshold)
    except ValueError as exc:
        return _error(400, str(exc))

    if file is None or not file.filename:
        return _error(400, "No video file is selected.")

    work_dir = Path(tempfile.mkdtemp(prefix="jagungz-vid-"))
    ext = Path(file.filename).suffix.lower() or ".mp4"
    input_path = work_dir / f"upload{ext}"
    limit = settings.max_video_upload_bytes
    total = 0
    try:
        with open(input_path, "wb") as out_file:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > limit:
                    raise VideoRejected(
                        f"The video exceeds the upload limit of {max(1, limit // (1024 * 1024))} MB.",
                        status_code=413,
                    )
                out_file.write(chunk)
        if total < 12:
            raise VideoRejected("The video file is corrupted or cannot be read.")
        with open(input_path, "rb") as check_handle:
            validate_video_signature(check_handle.read(32), file.filename)
    except VideoRejected as exc:
        shutil.rmtree(work_dir, ignore_errors=True)
        return _error(exc.status_code, str(exc))
    finally:
        await file.close()

    job_id = uuid.uuid4().hex
    with _video_jobs_lock:
        _video_jobs[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "percent": 0,
            "processed_frames": 0,
            "total_frames": 0,
            "detections_so_far": 0,
            "message": "Video queued for analysis.",
            "work_dir": str(work_dir),
            "result": None,
            "output_path": None,
            "output_mime": None,
            "output_filename": None,
        }

    def run_job() -> None:
        service = get_inference_service()

        def on_progress(processed: int, total_est: int, det_count: int) -> None:
            pct = min(99, max(1, int(round((processed / max(1, total_est)) * 100))))
            with _video_jobs_lock:
                job = _video_jobs.get(job_id)
                if job:
                    job.update(
                        {
                            "status": "processing",
                            "percent": pct,
                            "processed_frames": processed,
                            "total_frames": total_est,
                            "detections_so_far": det_count,
                            "message": f"Analyzing sampled frame {processed} of {total_est}...",
                        }
                    )

        try:
            res = analyze_video_file(
                video_path=input_path,
                output_dir=work_dir,
                service=service,
                confidence_threshold=conf,
                sample_interval_sec=sample_interval_sec,
                progress_callback=on_progress,
            )
            with _video_jobs_lock:
                job = _video_jobs.get(job_id)
                if job:
                    job.update(
                        {
                            "status": "completed",
                            "percent": 100,
                            "result": res.summary,
                            "output_path": str(res.output_path),
                            "output_mime": res.output_mime,
                            "output_filename": res.output_filename,
                            "message": "Video analysis completed.",
                        }
                    )
        except (VideoRejected, InferenceUnavailable) as exc:
            with _video_jobs_lock:
                job = _video_jobs.get(job_id)
                if job:
                    job.update({"status": "failed", "message": str(exc)})
        except Exception:
            logger.exception("Video job %s failed", job_id)
            with _video_jobs_lock:
                job = _video_jobs.get(job_id)
                if job:
                    job.update({"status": "failed", "message": "Unable to process the uploaded video."})
        finally:
            input_path.unlink(missing_ok=True)

    threading.Thread(target=run_job, daemon=True).start()
    return JSONResponse(status_code=202, content={"success": True, "job_id": job_id, "status": "queued"})


@router.get("/detect/video/{job_id}")
def get_video_job(job_id: str) -> JSONResponse:
    with _video_jobs_lock:
        job = _video_jobs.get(job_id)
        if not job:
            return _error(404, "Video analysis job not found.")
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "job_id": job_id,
                "status": job["status"],
                "percent": job["percent"],
                "processed_frames": job["processed_frames"],
                "total_frames": job["total_frames"],
                "detections_so_far": job["detections_so_far"],
                "message": job["message"],
            },
        )


@router.get("/detect/video/{job_id}/result")
def get_video_result(job_id: str):
    with _video_jobs_lock:
        job = _video_jobs.get(job_id)
        if not job:
            return _error(404, "Video analysis job not found.")
        if job["status"] == "failed":
            return _error(422, job["message"])
        if job["status"] != "completed" or not job["result"]:
            return _error(409, "Video analysis is still in progress.")
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "job_id": job_id,
                "video_url": f"/api/detect/video/{job_id}/download",
                **job["result"],
            },
        )


@router.get("/detect/video/{job_id}/download")
def download_video_result(job_id: str):
    with _video_jobs_lock:
        job = _video_jobs.get(job_id)
        if not job or job["status"] != "completed" or not job["output_path"]:
            return _error(404, "Annotated video is not available.")
        return FileResponse(
            path=job["output_path"],
            media_type=job["output_mime"] or "video/webm",
            filename=job["output_filename"] or "faw-annotated.webm",
        )
