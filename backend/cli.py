"""Command-line inference used by the web app.

Prints one JSON object to stdout. Does not open a network port.

  python -m backend.cli status
  python -m backend.cli detect /path/to/leaf.jpg --conf 0.20
"""

from __future__ import annotations

import argparse
import base64
import json
import logging
import sys

from backend.services.image_processing import ImageRejected, decode_image, render_annotated_jpeg
from backend.services.inference import (
    InferenceUnavailable,
    get_inference_service,
    validate_confidence_threshold,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def _emit(payload: dict) -> None:
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")


def status() -> int:
    _emit(get_inference_service().status())
    return 0


def detect(path: str, confidence_threshold: float | None = None) -> int:
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

    service = get_inference_service()
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
        annotated = render_annotated_jpeg(image, detections)
    except Exception:
        logging.exception("Failed to render the annotated image")
        _emit({"success": False, "status": 500, "message": "Unable to process the uploaded image."})
        return 0

    _emit(
        {
            "success": True,
            "status": 200,
            "confidence_threshold": conf,
            "total_detections": len(detections),
            "detections": [item.to_dict() for item in detections],
            "annotated_image": base64.b64encode(annotated).decode("ascii"),
            "annotated_mime": "image/jpeg",
        }
    )
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("command", nargs="?", default="status")
    parser.add_argument("path", nargs="?")
    parser.add_argument("--conf", type=float, default=None)
    args, unknown = parser.parse_known_args(sys.argv[1:])

    if unknown:
        _emit({"success": False, "status": 400, "message": "Invalid detection arguments."})
        return 1
    if args.command == "status":
        return status()
    if args.command == "detect" and args.path:
        return detect(args.path, confidence_threshold=args.conf)
    _emit({"success": False, "status": 400, "message": "Unable to process the uploaded image."})
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
