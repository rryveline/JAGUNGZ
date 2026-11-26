"""Independent loader, inference, and comparison helpers for Experiment 2 (E2) vs Experiment 3 (E3)."""

from __future__ import annotations

import base64
import os
import time
from pathlib import Path

from PIL import Image

from backend.core.config import REPO_ROOT, settings
from backend.services.image_processing import BOX_RGB, render_annotated_jpeg
from backend.services.inference import (
    InferenceUnavailable,
    get_e2_inference_service,
    get_inference_service,
    validate_confidence_threshold,
)

# Distinct visual color for E2 annotations (teal-green), while E3 keeps orange BOX_RGB.
E2_BOX_RGB = (20, 116, 111)
E3_BOX_RGB = BOX_RGB


def load_model_e2() -> dict:
    """Load/inspect E2 (e2best.pt) independently without touching E3."""
    return get_e2_inference_service().metadata()


def load_model_e3() -> dict:
    """Load/inspect E3 (best.pt) independently without touching E2."""
    return get_inference_service().metadata()


def _find_validation_yaml() -> Path | None:
    raw = os.environ.get("VALIDATION_DATA_YAML")
    if raw and raw.strip():
        candidate = Path(raw.strip())
        if not candidate.is_absolute():
            candidate = (REPO_ROOT / candidate).resolve()
        if candidate.is_file():
            return candidate
    for rel in ("data.yaml", "dataset/data.yaml", "backend/data/data.yaml"):
        p = REPO_ROOT / rel
        if p.is_file():
            return p
    return None


def models_status() -> dict:
    e2_meta = load_model_e2()
    e3_meta = load_model_e3()

    e2_names = e2_meta.get("class_map") or {}
    e3_names = e3_meta.get("class_map") or {}
    both_ready = bool(e2_meta.get("model_ready")) and bool(e3_meta.get("model_ready"))
    class_compatible = (not both_ready) or (e2_names == e3_names)
    compatibility_warning = None
    if both_ready and not class_compatible:
        compatibility_warning = (
            f"Class mapping mismatch: E2 uses {e2_names} while E3 uses {e3_names}. "
            "Direct comparison may be misleading."
        )

    val_yaml = _find_validation_yaml()
    return {
        "success": True,
        "e2": {
            **e2_meta,
            "experiment": "Experiment 2",
            "status_badge": "Comparison Model",
            "is_production": False,
        },
        "e3": {
            **e3_meta,
            "experiment": "Experiment 3",
            "status_badge": "Current Production Model",
            "is_production": True,
        },
        "class_compatible": class_compatible,
        "compatibility_warning": compatibility_warning,
        "validation_available": val_yaml is not None,
        "validation_message": (
            f"Validation dataset found at {val_yaml.name}."
            if val_yaml is not None
            else "Quantitative evaluation unavailable – validation dataset or ground-truth labels not found."
        ),
    }


def _summarize_detections(detections: list, inference_ms: float) -> dict:
    confs = [d.confidence for d in detections]
    classes = sorted({d.class_name for d in detections})
    return {
        "total_detections": len(detections),
        "detections": [d.to_dict() for d in detections],
        "detected_classes": classes,
        "num_detected_classes": len(classes),
        "max_confidence": round(max(confs), 4) if confs else 0.0,
        "min_confidence": round(min(confs), 4) if confs else 0.0,
        "average_confidence": round(sum(confs) / len(confs), 4) if confs else 0.0,
        "inference_ms": round(inference_ms, 1),
    }


def predict_e2(image: Image.Image, confidence_threshold: float | None = None, render_image: bool = True) -> dict:
    conf = validate_confidence_threshold(confidence_threshold)
    service = get_e2_inference_service()
    t0 = time.perf_counter()
    try:
        detections = service.predict(image, confidence_threshold=conf)
    except InferenceUnavailable as exc:
        return {"available": False, "error": str(exc), "total_detections": 0, "detections": [], "inference_ms": 0.0}
    except Exception:
        return {
            "available": False,
            "error": "E2 inference failed on the uploaded image.",
            "total_detections": 0,
            "detections": [],
            "inference_ms": 0.0,
        }
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    payload = {"available": True, "error": None, **_summarize_detections(detections, elapsed_ms)}
    if render_image:
        annotated = render_annotated_jpeg(image, detections, box_rgb=E2_BOX_RGB)
        payload["annotated_image"] = base64.b64encode(annotated).decode("ascii")
        payload["annotated_mime"] = "image/jpeg"
    return payload


def predict_e3(image: Image.Image, confidence_threshold: float | None = None, render_image: bool = True) -> dict:
    conf = validate_confidence_threshold(confidence_threshold)
    service = get_inference_service()
    t0 = time.perf_counter()
    try:
        detections = service.predict(image, confidence_threshold=conf)
    except InferenceUnavailable as exc:
        return {"available": False, "error": str(exc), "total_detections": 0, "detections": [], "inference_ms": 0.0}
    except Exception:
        return {
            "available": False,
            "error": "E3 inference failed on the uploaded image.",
            "total_detections": 0,
            "detections": [],
            "inference_ms": 0.0,
        }
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    payload = {"available": True, "error": None, **_summarize_detections(detections, elapsed_ms)}
    if render_image:
        annotated = render_annotated_jpeg(image, detections, box_rgb=E3_BOX_RGB)
        payload["annotated_image"] = base64.b64encode(annotated).decode("ascii")
        payload["annotated_mime"] = "image/jpeg"
    return payload


def compare_models(image: Image.Image, confidence_threshold: float | None = None) -> dict:
    conf = validate_confidence_threshold(confidence_threshold)
    status = models_status()
    e2_res = predict_e2(image, confidence_threshold=conf, render_image=True)
    e3_res = predict_e3(image, confidence_threshold=conf, render_image=True)

    if not e2_res["available"] and not e3_res["available"]:
        return {
            "success": False,
            "status": 503,
            "message": "Both E2 and E3 models are unavailable.",
        }

    return {
        "success": True,
        "status": 200,
        "confidence_threshold": conf,
        "iou_threshold": settings.iou_threshold,
        "imgsz": settings.imgsz,
        "image_width": image.width,
        "image_height": image.height,
        "class_compatible": status["class_compatible"],
        "compatibility_warning": status["compatibility_warning"],
        "validation_available": status["validation_available"],
        "validation_message": status["validation_message"],
        "e2_meta": status["e2"],
        "e3_meta": status["e3"],
        "e2": e2_res,
        "e3": e3_res,
    }
