"""Load the trained YOLO26 weights once and run inference.

The service never downloads a generic checkpoint. If `best.pt` is missing,
prediction fails with an explicit error.
"""

from __future__ import annotations

import logging
import math
import threading
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from backend.core.config import (
    MAX_CONFIDENCE_THRESHOLD,
    MIN_CONFIDENCE_THRESHOLD,
    settings,
    weights_hint,
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
    def __init__(self, model_path: Path | None = None, model_label: str = "E3") -> None:
        self._lock = threading.Lock()
        self._model_path = model_path
        self._model_label = model_label
        self._model = None
        self._message = "The detection model has not been loaded yet."
        self._signature: tuple | None = None

    def _effective_path(self) -> Path:
        return self._model_path if self._model_path is not None else settings.model_path

    def metadata(self) -> dict:
        with self._lock:
            self._reload_if_needed()
            names: dict[int, str] = {}
            architecture = "YOLO26"
            train_imgsz = settings.imgsz
            run_name = self._model_label
            if self._model is not None:
                raw_names = getattr(self._model, "names", None) or {}
                if isinstance(raw_names, dict):
                    names = {int(k): str(v) for k, v in raw_names.items()}
                elif isinstance(raw_names, (list, tuple)):
                    names = {idx: str(v) for idx, v in enumerate(raw_names)}
                ckpt = getattr(self._model, "ckpt", None) or {}
                train_args = ckpt.get("train_args", {}) if isinstance(ckpt, dict) else {}
                if isinstance(train_args, dict):
                    base_model = str(train_args.get("model") or "")
                    if "yolo26" in base_model.lower():
                        architecture = base_model.replace(".pt", "").upper()
                    if isinstance(train_args.get("imgsz"), int):
                        train_imgsz = int(train_args["imgsz"])
                    if train_args.get("name"):
                        run_name = str(train_args["name"])
            path = self._effective_path()
            return {
                "label": self._model_label,
                "run_name": run_name,
                "file": path.name,
                "weights_hint": weights_hint(path),
                "model_ready": self._model is not None,
                "architecture": architecture,
                "num_classes": len(names),
                "class_names": list(names.values()),
                "class_map": {str(k): v for k, v in names.items()},
                "train_imgsz": train_imgsz,
                "inference_imgsz": settings.imgsz,
                "confidence_threshold": settings.confidence_threshold,
                "iou_threshold": settings.iou_threshold,
                "message": self._message,
            }

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
        path = self._effective_path()
        return {
            "service": "ok",
            "model_ready": self._model is not None,
            "class_name": settings.class_name,
            "confidence_threshold": settings.confidence_threshold,
            "iou_threshold": settings.iou_threshold,
            "imgsz": settings.imgsz,
            "max_upload_bytes": settings.max_upload_bytes,
            "max_video_upload_bytes": settings.max_video_upload_bytes,
            "max_video_duration_sec": settings.max_video_duration_sec,
            "video_sample_interval_sec": settings.video_sample_interval_sec,
            "weights_hint": weights_hint(path),
            "message": self._message,
        }

    def _signature_of_weights(self) -> tuple:
        path = self._effective_path()
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
        path = self._effective_path()
        hint = weights_hint(path)
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
_e2_service: InferenceService | None = None
_service_lock = threading.Lock()


def get_inference_service() -> InferenceService:
    global _service
    with _service_lock:
        if _service is None:
            _service = InferenceService(model_path=None, model_label="E3")
        return _service


def get_e2_inference_service() -> InferenceService:
    global _e2_service
    with _service_lock:
        if _e2_service is None:
            _e2_service = InferenceService(model_path=settings.e2_model_path, model_label="E2")
        return _e2_service
