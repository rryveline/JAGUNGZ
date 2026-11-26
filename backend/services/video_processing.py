"""Video validation, frame sampling, YOLO annotation, and output encoding."""

from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from PIL import Image

from backend.core.config import DEFAULT_MAX_FRAME_SIDE, settings
from backend.services.image_processing import BOX_RGB, INK_RGB

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".webm"}


class VideoRejected(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class VideoAnalysisResult:
    summary: dict
    output_path: Path
    output_mime: str
    output_filename: str


def format_timestamp_ms(ms: float) -> str:
    total_ms = max(0, int(round(ms)))
    hours = total_ms // 3_600_000
    rem = total_ms % 3_600_000
    minutes = rem // 60_000
    rem = rem % 60_000
    seconds = rem // 1000
    millis = rem % 1000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}"


def validate_video_signature(header: bytes, filename: str) -> None:
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise VideoRejected("Unsupported video format. Upload an MP4, MOV, AVI, or WEBM file.")
    if len(header) < 12:
        raise VideoRejected("The video file is corrupted or cannot be read.")

    is_mp4_or_mov = header[4:8] == b"ftyp"
    is_avi = header[:4] == b"RIFF" and header[8:12] == b"AVI "
    is_webm = header[:4] == b"\x1a\x45\xdf\xa3"

    if not (is_mp4_or_mov or is_avi or is_webm):
        raise VideoRejected("Invalid video file signature. Upload a valid MP4, MOV, AVI, or WEBM video.")


def _resize_preserve_aspect(frame_bgr, max_side: int = DEFAULT_MAX_FRAME_SIDE):
    import cv2

    h, w = frame_bgr.shape[:2]
    longest = max(h, w)
    if longest <= max_side:
        return frame_bgr
    scale = max_side / float(longest)
    new_w = max(2, int(round(w * scale)) // 2 * 2)
    new_h = max(2, int(round(h * scale)) // 2 * 2)
    return cv2.resize(frame_bgr, (new_w, new_h), interpolation=cv2.INTER_AREA)


def _draw_boxes_bgr(
    frame_bgr,
    detections: list,
    box_rgb: tuple[int, int, int] = BOX_RGB,
    label_prefix: str = "",
):
    import cv2

    if not detections:
        return frame_bgr
    canvas = frame_bgr.copy()
    height, width = canvas.shape[:2]
    thickness = max(2, int(round(min(height, width) / 280)))
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = max(0.5, min(height, width) / 1100.0)
    text_thickness = max(1, thickness - 1)
    color = (box_rgb[2], box_rgb[1], box_rgb[0])
    ink = (INK_RGB[2], INK_RGB[1], INK_RGB[0])

    for detection in detections:
        x1, y1, x2, y2 = detection.bbox
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, thickness, lineType=cv2.LINE_AA)
        label = f"{label_prefix}{detection.class_name} {detection.confidence * 100:.1f}%"
        (text_width, text_height), baseline = cv2.getTextSize(label, font, scale, text_thickness)
        pad = 4
        top = y1 - text_height - baseline - pad * 2
        if top < 0:
            top = 0
        left = min(x1, max(0, width - text_width - pad * 2))
        bottom = min(height - 1, top + text_height + baseline + pad * 2)
        right = min(width - 1, left + text_width + pad * 2)
        cv2.rectangle(canvas, (left, top), (right, bottom), color, thickness=-1, lineType=cv2.LINE_AA)
        cv2.putText(
            canvas,
            label,
            (left + pad, min(height - 2, top + text_height + pad)),
            font,
            scale,
            ink,
            text_thickness,
            cv2.LINE_AA,
        )
    return canvas


def _open_video_writer(output_dir: Path, base_name: str, fps: float, width: int, height: int):
    import cv2

    candidates = [
        (".webm", "VP80", "video/webm"),
        (".webm", "vp09", "video/webm"),
        (".mp4", "mp4v", "video/mp4"),
    ]
    for ext, fourcc_str, mime in candidates:
        out_path = output_dir / f"{base_name}{ext}"
        writer = cv2.VideoWriter(
            str(out_path),
            cv2.VideoWriter_fourcc(*fourcc_str),
            fps,
            (width, height),
        )
        if writer.isOpened():
            return writer, out_path, mime
        writer.release()
        if out_path.exists():
            out_path.unlink(missing_ok=True)
    raise RuntimeError("Could not initialize video encoder for annotated output.")


def analyze_video_file(
    video_path: Path,
    output_dir: Path,
    service,
    confidence_threshold: float,
    sample_interval_sec: float | None = None,
    max_sampled_frames: int | None = None,
    max_duration_sec: float | None = None,
    progress_callback: Callable[[int, int, int], None] | None = None,
    model_mode: str = "e3",
    e2_service=None,
) -> VideoAnalysisResult:
    import cv2
    import time

    interval = sample_interval_sec if sample_interval_sec is not None else settings.video_sample_interval_sec
    if not math.isfinite(interval) or interval < 0.2 or interval > 5.0:
        raise VideoRejected("Sample interval must be between 0.2 and 5.0 seconds.")

    cap_frames = max_sampled_frames if max_sampled_frames is not None else settings.max_video_sampled_frames
    limit_duration = max_duration_sec if max_duration_sec is not None else settings.max_video_duration_sec

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise VideoRejected("Unable to open the uploaded video. It may be corrupted or use an unsupported codec.")

    try:
        fps = float(cap.get(cv2.CAP_PROP_FPS) or 0.0)
        if not math.isfinite(fps) or fps <= 0.0 or fps > 120.0:
            fps = 25.0
        total_frames_meta = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if total_frames_meta > 0:
            est_duration = total_frames_meta / fps
            if est_duration > limit_duration:
                raise VideoRejected(
                    f"Video duration ({est_duration:.1f}s) exceeds the maximum allowed {int(limit_duration)}s."
                )

        ok, first_frame = cap.read()
        if not ok or first_frame is None:
            raise VideoRejected("The video contains no readable frames.")

        first_resized = _resize_preserve_aspect(first_frame)
        out_h, out_w = first_resized.shape[:2]
        step_frames = max(1, int(round(fps * interval)))
        est_total_sampled = (
            min(cap_frames, max(1, (total_frames_meta + step_frames - 1) // step_frames))
            if total_frames_meta > 0
            else cap_frames
        )

        writer, out_path, out_mime = _open_video_writer(output_dir, "faw-annotated", fps, out_w, out_h)
        try:
            analyzed_count = 0
            frames_with_detection = 0
            total_detections = 0
            confidence_sum = 0.0
            timeline: list[dict] = []
            last_detections: list = []
            last_e2_detections: list = []

            e2_frames_det = 0
            e2_total_det = 0
            e2_conf_sum = 0.0
            e2_ms_sum = 0.0
            e3_frames_det = 0
            e3_total_det = 0
            e3_conf_sum = 0.0
            e3_ms_sum = 0.0

            frame_idx = 0
            current_frame = first_resized
            while True:
                elapsed_sec = frame_idx / fps
                if elapsed_sec > limit_duration:
                    raise VideoRejected(
                        f"Video duration exceeds the maximum allowed {int(limit_duration)}s."
                    )

                if frame_idx % step_frames == 0 and analyzed_count < cap_frames:
                    rgb = cv2.cvtColor(current_frame, cv2.COLOR_BGR2RGB)
                    pil_image = Image.fromarray(rgb)
                    analyzed_count += 1
                    ts_ms = elapsed_sec * 1000.0

                    if model_mode == "compare" and e2_service is not None:
                        t_e2 = time.perf_counter()
                        e2_dets = e2_service.predict(pil_image, confidence_threshold=confidence_threshold)
                        e2_ms = (time.perf_counter() - t_e2) * 1000.0
                        t_e3 = time.perf_counter()
                        e3_dets = service.predict(pil_image, confidence_threshold=confidence_threshold)
                        e3_ms = (time.perf_counter() - t_e3) * 1000.0

                        e2_ms_sum += e2_ms
                        e3_ms_sum += e3_ms
                        last_e2_detections = e2_dets
                        last_detections = e3_dets

                        if e2_dets:
                            e2_frames_det += 1
                            e2_total_det += len(e2_dets)
                            e2_conf_sum += sum(d.confidence for d in e2_dets)
                        if e3_dets:
                            e3_frames_det += 1
                            e3_total_det += len(e3_dets)
                            e3_conf_sum += sum(d.confidence for d in e3_dets)

                        combined = e2_dets + e3_dets
                        if combined:
                            frames_with_detection += 1
                            total_detections += len(combined)
                            confs = [d.confidence for d in combined]
                            confidence_sum += sum(confs)
                            timeline.append(
                                {
                                    "timestamp_ms": round(ts_ms),
                                    "timestamp": format_timestamp_ms(ts_ms),
                                    "frame_index": frame_idx,
                                    "detections_count": len(combined),
                                    "e2_detections_count": len(e2_dets),
                                    "e3_detections_count": len(e3_dets),
                                    "max_confidence": round(max(confs), 4),
                                    "avg_confidence": round(sum(confs) / len(confs), 4),
                                    "detections": [d.to_dict() for d in combined],
                                }
                            )
                    else:
                        active_service = e2_service if (model_mode == "e2" and e2_service is not None) else service
                        t_m = time.perf_counter()
                        detections = active_service.predict(pil_image, confidence_threshold=confidence_threshold)
                        m_ms = (time.perf_counter() - t_m) * 1000.0
                        if model_mode == "e2":
                            e2_ms_sum += m_ms
                        else:
                            e3_ms_sum += m_ms
                        last_detections = detections

                        if detections:
                            frames_with_detection += 1
                            total_detections += len(detections)
                            confs = [d.confidence for d in detections]
                            confidence_sum += sum(confs)
                            timeline.append(
                                {
                                    "timestamp_ms": round(ts_ms),
                                    "timestamp": format_timestamp_ms(ts_ms),
                                    "frame_index": frame_idx,
                                    "detections_count": len(detections),
                                    "max_confidence": round(max(confs), 4),
                                    "avg_confidence": round(sum(confs) / len(confs), 4),
                                    "detections": [d.to_dict() for d in detections],
                                }
                            )

                    if progress_callback is not None:
                        progress_callback(analyzed_count, max(analyzed_count, est_total_sampled), total_detections)

                if model_mode == "compare":
                    annotated_frame = _draw_boxes_bgr(current_frame, last_e2_detections, box_rgb=(20, 116, 111), label_prefix="[E2] ")
                    annotated_frame = _draw_boxes_bgr(annotated_frame, last_detections, box_rgb=BOX_RGB, label_prefix="[E3] ")
                elif model_mode == "e2":
                    annotated_frame = _draw_boxes_bgr(current_frame, last_detections, box_rgb=(20, 116, 111), label_prefix="[E2] ")
                else:
                    annotated_frame = _draw_boxes_bgr(current_frame, last_detections)
                writer.write(annotated_frame)

                ok, next_frame = cap.read()
                if not ok or next_frame is None:
                    break
                frame_idx += 1
                current_frame = _resize_preserve_aspect(next_frame)
                if current_frame.shape[1] != out_w or current_frame.shape[0] != out_h:
                    current_frame = cv2.resize(current_frame, (out_w, out_h), interpolation=cv2.INTER_AREA)
        finally:
            writer.release()

        duration_sec = (frame_idx + 1) / fps
        avg_confidence = round(confidence_sum / total_detections, 4) if total_detections > 0 else 0.0
        summary: dict = {
            "detection_method": "video",
            "model_mode": model_mode,
            "confidence_threshold": confidence_threshold,
            "sample_interval_sec": interval,
            "duration_sec": round(duration_sec, 2),
            "total_frames_analyzed": analyzed_count,
            "frames_with_detection": frames_with_detection,
            "total_detections": total_detections,
            "detection_class": settings.class_name,
            "average_confidence": avg_confidence,
            "timeline": timeline,
            "output_mime": out_mime,
            "output_filename": out_path.name,
        }
        if model_mode == "compare":
            summary["e2_summary"] = {
                "total_detections": e2_total_det,
                "frames_with_detection": e2_frames_det,
                "average_confidence": round(e2_conf_sum / e2_total_det, 4) if e2_total_det > 0 else 0.0,
                "avg_inference_ms": round(e2_ms_sum / max(1, analyzed_count), 1),
            }
            summary["e3_summary"] = {
                "total_detections": e3_total_det,
                "frames_with_detection": e3_frames_det,
                "average_confidence": round(e3_conf_sum / e3_total_det, 4) if e3_total_det > 0 else 0.0,
                "avg_inference_ms": round(e3_ms_sum / max(1, analyzed_count), 1),
            }
        return VideoAnalysisResult(
            summary=summary,
            output_path=out_path,
            output_mime=out_mime,
            output_filename=out_path.name,
        )
    finally:
        cap.release()
