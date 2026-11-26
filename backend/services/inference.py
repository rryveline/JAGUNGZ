"""Load the trained YOLO26 weights once and run inference.

The service never downloads a generic checkpoint. If `best.pt` is missing,
prediction fails with an explicit error.
"""

from __future__ import annotations

import logging
import math
import threading
from dataclasses import dataclass

from PIL import Image

from backend.core.config import (
    MAX_CONFIDENCE_THRESHOLD,
    MIN_CONFIDENCE_THRESHOLD,
    settings,
)

logger = logging.getLogger(__name__)


def validate_confidence_threshold(value: float | None) -> float:
    """Validate user-supplied confidence threshold against [0.05, 0.90]."""
    if value is None:
        return settings.confidence_threshold
    if not math.isfinite(value) or value < MIN_CONFIDENCE_THRESHOLD - 1e-9 or value > MAX_CONFIDENCE_THRESHOLD + 1e-9:
        raise ValueError(
            f"Confidence threshold must be between {MIN_CONFIDENCE_THRESHOLD:.2f} and {MAX_CONFIDENCE_THRESHOLD:.2f}."
        )
    return round(min(MAX_CONFIDENCE_THRESHOLD, max(MIN_CONFIDENCE_THRESHOLD, value)), 4)


class InferenceUnavailable(Exception):
    pass


@dataclass(frozen=True)
class Detection:
    class_name: str
    confidence: float
    bbox: tuple[int, int, int, int]

    def to_dict(self) -> dict:
        return {
            "class": self.class_name,
            "confidence": round(self.confidence, 4),
            "bbox": [self.bbox[0], self.bbox[1], self.bbox[2], self.bbox[3]],
        }


def clip_box(xyxy: list[float], width: int, height: int) -> tuple[int, int, int, int] | None:
    x1, y1, x2, y2 = xyxy
    left = max(0, min(width - 1, int(round(min(x1, x2)))))
    top = max(0, min(height - 1, int(round(min(y1, y2)))))
    right = max(0, min(width, int(round(max(x1, x2)))))
    bottom = max(0, min(height, int(round(max(y1, y2)))))
    if right - left < 2 or bottom - top < 2:
        return None
    return left, top, right, bottom


class InferenceService:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._model = None
        self._message = "The detection model has not been loaded yet."
        self._signature: tuple | None = None

    def status(self) -> dict:
        with self._lock:
            self._reload_if_needed()
            return self._status_payload()

    def predict(self, image: Image.Image, confidence_threshold: float | None = None) -> list[Detection]:
        conf = validate_confidence_threshold(confidence_threshold)
        with self._lock:
            self._reload_if_needed()
            if self._model is None:
                raise InferenceUnavailable(self._message)
            return self._predict_locked(image, conf)

    def _status_payload(self) -> dict:
        return {
            "service": "ok",
            "model_ready": self._model is not None,
            "class_name": settings.class_name,
            "confidence_threshold": settings.confidence_threshold,
            "iou_threshold": settings.iou_threshold,
            "imgsz": settings.imgsz,
            "max_upload_bytes": settings.max_upload_bytes,
            "weights_hint": settings.weights_hint,
            "message": self._message,
        }

    def _signature_of_weights(self) -> tuple:
        path = settings.model_path
        if not path.is_file():
            return ("missing", str(path))
        stat = path.stat()
        return ("file", str(path), stat.st_mtime_ns, stat.st_size)

    def _reload_if_needed(self) -> None:
        signature = self._signature_of_weights()
        if signature == self._signature:
            return
        self._signature = signature
        self._model = None
        path = settings.model_path
        hint = settings.weights_hint
        if not path.is_file():
            self._message = (
                f"Trained YOLO26 weights were not found at {hint}. "
                "Place your best.pt file there. A generic pretrained model will not be used."
            )
            logger.info("YOLO weights missing at %s", path)
            return
        try:
            from ultralytics import YOLO
        except ImportError:
            self._message = (
                "Ultralytics is not installed, so the YOLO26 weights cannot be loaded. "
                "Install the backend requirements and restart the detection service."
            )
            logger.warning("Ultralytics is not installed")
            return
        try:
            self._model = YOLO(str(path))
        except Exception:
            logger.exception("Failed to load YOLO weights at %s", path)
            self._message = (
                "The weights file could not be loaded. "
                f"Check that {hint} is a YOLO26 checkpoint from your training run."
            )
            return
        self._message = "Custom YOLO26 weights are loaded."
        logger.info("Loaded YOLO weights from %s", path)

    def _predict_locked(self, image: Image.Image, conf: float) -> list[Detection]:
        predict_kwargs: dict = {
            "source": image,
            "conf": conf,
            "iou": settings.iou_threshold,
            "imgsz": settings.imgsz,
            "verbose": False,
            "save": False,
        }
        results = self._model.predict(**predict_kwargs)
        if not results:
            return []
        return _extract(results[0], image.width, image.height)


def _class_name(names, class_id: int) -> str:
    raw = "infected"
    if isinstance(names, dict):
        raw = names.get(class_id, names.get(str(class_id), "infected"))
    elif isinstance(names, (list, tuple)) and 0 <= class_id < len(names):
        raw = names[class_id]
    text = str(raw).strip().replace("\n", " ")[:64]
    return text or "infected"


def _extract(result, width: int, height: int) -> list[Detection]:
    boxes = getattr(result, "boxes", None)
    if boxes is None or len(boxes) == 0:
        return []
    names = getattr(result, "names", None) or {}
    found: list[Detection] = []
    for box in boxes:
        class_id = int(box.cls[0])
        confidence = float(box.conf[0])
        clipped = clip_box(box.xyxy[0].tolist(), width, height)
        if clipped is None:
            continue
        found.append(Detection(_class_name(names, class_id), confidence, clipped))
    found.sort(key=lambda item: item.confidence, reverse=True)
    return found


_service: InferenceService | None = None
_service_lock = threading.Lock()


def get_inference_service() -> InferenceService:
    global _service
    with _service_lock:
        if _service is None:
            _service = InferenceService()
        return _service
