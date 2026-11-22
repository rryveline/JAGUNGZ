"""Command-line inference used by the web app.

Prints one JSON object to stdout. Does not open a network port.

  python -m backend.cli status
  python -m backend.cli detect /path/to/leaf.jpg
"""

from __future__ import annotations

import base64
import json
import logging
import sys

from backend.services.image_processing import ImageRejected, decode_image, render_annotated_jpeg
from backend.services.inference import InferenceUnavailable, get_inference_service

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def _emit(payload: dict) -> None:
    json.dump(payload, sys.stdout)
    sys.stdout.write("\n")


def status() -> int:
    _emit(get_inference_service().status())
    return 0


def detect(path: str) -> int:
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
        detections = service.predict(image)
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
            "total_detections": len(detections),
            "detections": [item.to_dict() for item in detections],
            "annotated_image": base64.b64encode(annotated).decode("ascii"),
            "annotated_mime": "image/jpeg",
        }
    )
    return 0


def main() -> int:
    command = sys.argv[1] if len(sys.argv) > 1 else "status"
    if command == "status":
        return status()
    if command == "detect" and len(sys.argv) > 2:
        return detect(sys.argv[2])
    _emit({"success": False, "status": 400, "message": "Unable to process the uploaded image."})
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
