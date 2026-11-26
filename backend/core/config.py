"""Inference settings."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
DEFAULT_MODEL_PATH = BACKEND_DIR / "models" / "best.pt"
DEFAULT_E2_MODEL_PATH = BACKEND_DIR / "models" / "e2best.pt"

MIN_CONFIDENCE_THRESHOLD = 0.05
MAX_CONFIDENCE_THRESHOLD = 0.90
DEFAULT_CONFIDENCE_THRESHOLD = 0.20
DEFAULT_IOU_THRESHOLD = 0.50
DEFAULT_IMGSZ = 1280
DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
DEFAULT_MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024
DEFAULT_MAX_VIDEO_DURATION_SEC = 120.0
DEFAULT_VIDEO_SAMPLE_INTERVAL_SEC = 0.5
DEFAULT_MAX_VIDEO_SAMPLED_FRAMES = 120
DEFAULT_MAX_FRAME_SIDE = 1280
EXPECTED_CLASS_NAME = "infected"


def _float_env(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = float(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be a number.") from exc
    return value


def _confidence_threshold() -> float:
    value = _float_env("CONFIDENCE_THRESHOLD", DEFAULT_CONFIDENCE_THRESHOLD)
    if not MIN_CONFIDENCE_THRESHOLD <= value <= MAX_CONFIDENCE_THRESHOLD:
        raise RuntimeError(
            f"CONFIDENCE_THRESHOLD must be between {MIN_CONFIDENCE_THRESHOLD:.2f} and {MAX_CONFIDENCE_THRESHOLD:.2f}."
        )
    return round(value, 4)


def _int_env(name: str, default: int, minimum: int = 32) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"{name} must be an integer.") from exc
    if value < minimum:
        raise RuntimeError(f"{name} must be at least {minimum}.")
    return value


def _optional_unit_interval(name: str) -> float | None:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return None
    value = _float_env(name, 0.0)
    if not 0 < value <= 1:
        raise RuntimeError(f"{name} must be greater than 0 and at most 1.")
    return value


def _max_upload_bytes() -> int:
    raw = os.environ.get("MAX_UPLOAD_BYTES")
    if raw is None or raw.strip() == "":
        return DEFAULT_MAX_UPLOAD_BYTES
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError("MAX_UPLOAD_BYTES must be an integer.") from exc
    if value < 1:
        raise RuntimeError("MAX_UPLOAD_BYTES must be positive.")
    return value


def _model_path() -> Path:
    raw = os.environ.get("MODEL_PATH")
    if raw is None or raw.strip() == "":
        return DEFAULT_MODEL_PATH
    path = Path(raw)
    if not path.is_absolute():
        return (REPO_ROOT / path).resolve()
    return path


def _e2_model_path() -> Path:
    raw = os.environ.get("E2_MODEL_PATH")
    if raw is None or raw.strip() == "":
        return DEFAULT_E2_MODEL_PATH
    path = Path(raw)
    if not path.is_absolute():
        return (REPO_ROOT / path).resolve()
    return path


def weights_hint(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return path.name


@dataclass(frozen=True)
class Settings:
    model_path: Path
    e2_model_path: Path
    confidence_threshold: float
    iou_threshold: float
    imgsz: int
    max_upload_bytes: int
    max_video_upload_bytes: int
    max_video_duration_sec: float
    video_sample_interval_sec: float
    max_video_sampled_frames: int
    class_name: str

    @property
    def weights_hint(self) -> str:
        return weights_hint(self.model_path)


def load_settings() -> Settings:
    iou = _optional_unit_interval("IOU_THRESHOLD")
    return Settings(
        model_path=_model_path(),
        e2_model_path=_e2_model_path(),
        confidence_threshold=_confidence_threshold(),
        iou_threshold=DEFAULT_IOU_THRESHOLD if iou is None else iou,
        imgsz=_int_env("INFERENCE_IMGSZ", DEFAULT_IMGSZ, minimum=320),
        max_upload_bytes=_max_upload_bytes(),
        max_video_upload_bytes=_int_env("MAX_VIDEO_UPLOAD_BYTES", DEFAULT_MAX_VIDEO_UPLOAD_BYTES, minimum=1024 * 1024),
        max_video_duration_sec=_float_env("MAX_VIDEO_DURATION_SEC", DEFAULT_MAX_VIDEO_DURATION_SEC),
        video_sample_interval_sec=_float_env("VIDEO_SAMPLE_INTERVAL_SEC", DEFAULT_VIDEO_SAMPLE_INTERVAL_SEC),
        max_video_sampled_frames=_int_env("MAX_VIDEO_SAMPLED_FRAMES", DEFAULT_MAX_VIDEO_SAMPLED_FRAMES, minimum=1),
        class_name=EXPECTED_CLASS_NAME,
    )


settings = load_settings()
