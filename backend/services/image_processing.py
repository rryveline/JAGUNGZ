"""Validate uploads and draw detection boxes on a copy of the image."""

from __future__ import annotations

import io

from PIL import Image, ImageDraw, ImageFont, ImageOps

Image.MAX_IMAGE_PIXELS = 48_000_000

JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
BOX_RGB = (232, 93, 4)
INK_RGB = (23, 38, 30)


class ImageRejected(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def decode_image(raw: bytes) -> Image.Image:
    """Return an RGB copy. The original bytes are never modified."""
    if not raw:
        raise ImageRejected("The file is corrupted or cannot be read.")
    if raw.startswith(JPEG_MAGIC) or raw.startswith(PNG_MAGIC):
        pass
    else:
        raise ImageRejected("Unsupported file. Upload a JPG, JPEG, or PNG image.")

    try:
        with Image.open(io.BytesIO(raw)) as incoming:
            incoming.load()
            # Normalize EXIF orientation so bounding boxes align with browser rendering.
            transposed = ImageOps.exif_transpose(incoming)
            image = transposed.convert("RGB")
    except Image.DecompressionBombError as exc:
        raise ImageRejected("The file is corrupted or cannot be read.") from exc
    except Exception as exc:
        raise ImageRejected("The file is corrupted or cannot be read.") from exc

    if image.width < 2 or image.height < 2:
        raise ImageRejected("The file is corrupted or cannot be read.")
    return image


def render_annotated_jpeg(image: Image.Image, detections: list) -> bytes:
    """Draw boxes on a copy and return JPEG bytes."""
    try:
        return _jpeg_cv2(image, detections)
    except ImportError:
        return _jpeg_pillow(image, detections)


def _jpeg_cv2(image: Image.Image, detections: list) -> bytes:
    import cv2
    import numpy as np

    rgb = np.array(image.convert("RGB"))
    canvas = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    height, width = canvas.shape[:2]
    thickness = max(2, int(round(min(height, width) / 280)))
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = max(0.5, min(height, width) / 1100.0)
    text_thickness = max(1, thickness - 1)
    color = (BOX_RGB[2], BOX_RGB[1], BOX_RGB[0])
    ink = (INK_RGB[2], INK_RGB[1], INK_RGB[0])

    for detection in detections:
        x1, y1, x2, y2 = detection.bbox
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, thickness, lineType=cv2.LINE_AA)
        label = f"{detection.class_name} {detection.confidence * 100:.1f}%"
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

    ok, encoded = cv2.imencode(".jpg", canvas, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    if not ok:
        raise RuntimeError("Could not encode the annotated image.")
    return encoded.tobytes()


def _jpeg_pillow(image: Image.Image, detections: list) -> bytes:
    canvas = image.convert("RGB").copy()
    draw = ImageDraw.Draw(canvas)
    short_side = min(canvas.size)
    font = _font(max(14, int(round(short_side / 32))))
    stroke = max(2, int(round(short_side / 280)))

    for detection in detections:
        x1, y1, x2, y2 = detection.bbox
        draw.rectangle((x1, y1, x2, y2), outline=BOX_RGB, width=stroke)
        label = f"{detection.class_name} {detection.confidence * 100:.1f}%"
        text_box = draw.textbbox((0, 0), label, font=font)
        text_width = text_box[2] - text_box[0]
        text_height = text_box[3] - text_box[1]
        pad = 4
        top = y1 - text_height - pad * 2
        if top < 0:
            top = 0
        left = min(x1, max(0, canvas.width - text_width - pad * 2))
        draw.rectangle(
            (left, top, left + text_width + pad * 2, top + text_height + pad * 2),
            fill=BOX_RGB,
        )
        draw.text((left + pad, top + pad), label, fill=INK_RGB, font=font)

    buffer = io.BytesIO()
    canvas.save(buffer, format="JPEG", quality=92, optimize=True)
    return buffer.getvalue()


def _font(size: int) -> ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ):
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()
