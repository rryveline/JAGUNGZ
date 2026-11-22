"""Detection API: validate an upload, run YOLO26, return boxes and an annotated image."""

from __future__ import annotations

import base64
import logging

from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from backend.core.config import settings
from backend.services.image_processing import ImageRejected, decode_image, render_annotated_jpeg
from backend.services.inference import InferenceUnavailable, get_inference_service

logger = logging.getLogger(__name__)
router = APIRouter()


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


@router.post("/detect")
async def detect(file: UploadFile | None = File(default=None)) -> JSONResponse:
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
        detections = service.predict(image)
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
            "total_detections": len(detections),
            "detections": [item.to_dict() for item in detections],
            "annotated_image": base64.b64encode(annotated).decode("ascii"),
            "annotated_mime": "image/jpeg",
        },
    )
