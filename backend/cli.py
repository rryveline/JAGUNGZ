"""Command-line inference used by the web app.

Prints JSON lines to stdout. Does not open a network port.

  python -m backend.cli status
  python -m backend.cli detect /path/to/leaf.jpg --conf 0.20
  python -m backend.cli detect-frame /path/to/frame.jpg --conf 0.20
  python -m backend.cli detect-video /path/to/video.mp4 --out-dir /tmp/out --conf 0.20 --interval 0.5
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import sys
import time
from pathlib import Path

from backend.services.image_processing import ImageRejected, decode_image, render_annotated_jpeg
from backend.services.inference import (
    InferenceUnavailable,
    get_e2_inference_service,
    get_inference_service,
    validate_confidence_threshold,
)
from backend.services.model_comparison import compare_models, models_status, predict_e2, predict_e3
from backend.services.video_processing import (
    VideoRejected,
    analyze_video_file,
    validate_video_signature,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def _emit(payload: dict) -> None:
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")
    sys.stdout.flush()


def status() -> int:
    _emit(get_inference_service().status())
    return 0


def detect(path: str, confidence_threshold: float | None = None, model_mode: str = "e3") -> int:
    try:
        conf = validate_confidence_threshold(confidence_threshold)
    except ValueError as exc:
        _emit({"success": False, "status": 400, "message": str(exc)})
        return 0

    with open(path, "rb") as handle:
        raw = handle.read()
    if not raw:
        _emit({"success": False, "status": 400, "message": "The file is corrupted or cannot be read."})
        return 0
    try:
        image = decode_image(raw)
    except ImageRejected as exc:
        _emit({"success": False, "status": exc.status_code, "message": str(exc)})
        return 0

    service = get_e2_inference_service() if model_mode == "e2" else get_inference_service()
    try:
        detections = service.predict(image, confidence_threshold=conf)
    except InferenceUnavailable as exc:
        _emit({"success": False, "status": 503, "message": str(exc)})
        return 0
    except Exception:
        logging.exception("YOLO inference failed")
        _emit({"success": False, "status": 500, "message": "Unable to process the uploaded image."})
        return 0

    try:
        box_rgb = (20, 116, 111) if model_mode == "e2" else (232, 93, 4)
        annotated = render_annotated_jpeg(image, detections, box_rgb=box_rgb)
    except Exception:
        logging.exception("Failed to render the annotated image")
        _emit({"success": False, "status": 500, "message": "Unable to process the uploaded image."})
        return 0

    _emit(
        {
            "success": True,
            "status": 200,
            "model_mode": model_mode,
            "confidence_threshold": conf,
            "total_detections": len(detections),
            "detections": [item.to_dict() for item in detections],
            "annotated_image": base64.b64encode(annotated).decode("ascii"),
            "annotated_mime": "image/jpeg",
        }
    )
    return 0


def detect_frame(path: str, confidence_threshold: float | None = None, model_mode: str = "e3") -> int:
    try:
        conf = validate_confidence_threshold(confidence_threshold)
    except ValueError as exc:
        _emit({"success": False, "status": 400, "message": str(exc)})
        return 0

    with open(path, "rb") as handle:
        raw = handle.read()
    if not raw:
        _emit({"success": False, "status": 400, "message": "The frame is empty or cannot be read."})
        return 0
    try:
        image = decode_image(raw)
    except ImageRejected as exc:
        _emit({"success": False, "status": exc.status_code, "message": str(exc)})
        return 0

    if model_mode == "compare":
        e2_res = predict_e2(image, confidence_threshold=conf, render_image=False)
        e3_res = predict_e3(image, confidence_threshold=conf, render_image=False)
        _emit(
            {
                "success": True,
                "status": 200,
                "detection_method": "camera",
                "model_mode": "compare",
                "confidence_threshold": conf,
                "frame_width": image.width,
                "frame_height": image.height,
                "inference_ms": round(e2_res["inference_ms"] + e3_res["inference_ms"], 1),
                "total_detections": e3_res["total_detections"],
                "detections": e3_res["detections"],
                "e2": e2_res,
                "e3": e3_res,
            }
        )
        return 0

    service = get_e2_inference_service() if model_mode == "e2" else get_inference_service()
    t0 = time.perf_counter()
    try:
        detections = service.predict(image, confidence_threshold=conf)
    except InferenceUnavailable as exc:
        _emit({"success": False, "status": 503, "message": str(exc)})
        return 0
    except Exception:
        logging.exception("YOLO frame inference failed")
        _emit({"success": False, "status": 500, "message": "Unable to process the camera frame."})
        return 0

    elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
    _emit(
        {
            "success": True,
            "status": 200,
            "detection_method": "camera",
            "model_mode": model_mode,
            "confidence_threshold": conf,
            "frame_width": image.width,
            "frame_height": image.height,
            "inference_ms": elapsed_ms,
            "total_detections": len(detections),
            "detections": [item.to_dict() for item in detections],
        }
    )
    return 0


def compare_cmd(path: str, confidence_threshold: float | None = None) -> int:
    try:
        conf = validate_confidence_threshold(confidence_threshold)
    except ValueError as exc:
        _emit({"success": False, "status": 400, "message": str(exc)})
        return 0

    with open(path, "rb") as handle:
        raw = handle.read()
    if not raw:
        _emit({"success": False, "status": 400, "message": "The file is corrupted or cannot be read."})
        return 0
    try:
        image = decode_image(raw)
    except ImageRejected as exc:
        _emit({"success": False, "status": exc.status_code, "message": str(exc)})
        return 0

    _emit(compare_models(image, confidence_threshold=conf))
    return 0


def detect_video(
    path: str,
    out_dir: str,
    confidence_threshold: float | None = None,
    sample_interval_sec: float | None = None,
    model_mode: str = "e3",
) -> int:
    try:
        conf = validate_confidence_threshold(confidence_threshold)
    except ValueError as exc:
        _emit({"type": "result", "success": False, "status": 400, "message": str(exc)})
        return 0

    video_path = Path(path)
    if not video_path.is_file():
        _emit({"type": "result", "success": False, "status": 400, "message": "No video file is selected."})
        return 0

    with open(video_path, "rb") as handle:
        header = handle.read(32)
    try:
        validate_video_signature(header, video_path.name)
    except VideoRejected as exc:
        _emit({"type": "result", "success": False, "status": exc.status_code, "message": str(exc)})
        return 0

    output_dir = Path(out_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    service = get_inference_service()
    e2_service = get_e2_inference_service() if model_mode in ("e2", "compare") else None

    def on_progress(processed: int, total: int, detections_so_far: int) -> None:
        pct = min(99, max(1, int(round((processed / max(1, total)) * 100))))
        _emit(
            {
                "type": "progress",
                "processed_frames": processed,
                "total_frames": total,
                "percent": pct,
                "detections_so_far": detections_so_far,
            }
        )

    try:
        result = analyze_video_file(
            video_path=video_path,
            output_dir=output_dir,
            service=service,
            confidence_threshold=conf,
            sample_interval_sec=sample_interval_sec,
            progress_callback=on_progress,
            model_mode=model_mode,
            e2_service=e2_service,
        )
    except VideoRejected as exc:
        _emit({"type": "result", "success": False, "status": exc.status_code, "message": str(exc)})
        return 0
    except InferenceUnavailable as exc:
        _emit({"type": "result", "success": False, "status": 503, "message": str(exc)})
        return 0
    except Exception:
        logging.exception("YOLO video inference failed")
        _emit({"type": "result", "success": False, "status": 500, "message": "Unable to process the uploaded video."})
        return 0

    _emit(
        {
            "type": "result",
            "success": True,
            "status": 200,
            "output_path": str(result.output_path),
            **result.summary,
        }
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("command", nargs="?", default="status")
    parser.add_argument("path", nargs="?")
    parser.add_argument("--conf", type=float, default=None)
    parser.add_argument("--out-dir", default=None)
    parser.add_argument("--interval", type=float, default=None)
    parser.add_argument("--model", default="e3")
    args, unknown = parser.parse_known_args(sys.argv[1:])

    model_mode = args.model if args.model in ("e2", "e3", "compare") else "e3"

    if unknown:
        _emit({"success": False, "status": 400, "message": "Invalid detection arguments."})
        return 1
    if args.command == "status":
        return status()
    if args.command == "models-status":
        _emit(models_status())
        return 0
    if args.command == "compare" and args.path:
        return compare_cmd(args.path, confidence_threshold=args.conf)
    if args.command == "detect" and args.path:
        return detect(args.path, confidence_threshold=args.conf, model_mode=model_mode)
    if args.command == "detect-frame" and args.path:
        return detect_frame(args.path, confidence_threshold=args.conf, model_mode=model_mode)
    if args.command == "detect-video" and args.path and args.out_dir:
        return detect_video(
            args.path,
            out_dir=args.out_dir,
            confidence_threshold=args.conf,
            sample_interval_sec=args.interval,
            model_mode=model_mode,
        )
    _emit({"success": False, "status": 400, "message": "Unable to process the uploaded file."})
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
