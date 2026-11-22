# Detection service

FastAPI service that validates a corn-leaf image, runs the trained YOLO26 checkpoint, and returns bounding boxes plus an annotated JPEG.

## Weights

Copy the selected training checkpoint to `backend/models/best.pt`, or set `MODEL_PATH` to another `.pt` file.

The loader refuses to download a generic YOLO model. If the file is missing, `POST /api/detect` returns HTTP 503 and does not invent boxes.

## Settings

| Variable | Default | Role |
|---|---|---|
| `MODEL_PATH` | `backend/models/best.pt` | Trained weights |
| `CONFIDENCE_THRESHOLD` | `0.25` | Placeholder cutoff until validation picks the real one |
| `IOU_THRESHOLD` | unset | Optional NMS cutoff passed to Ultralytics |
| `MAX_UPLOAD_BYTES` | `10485760` | Upload limit (10 MB) |

## Run

From the repository root, with dependencies installed:

```bash
PYTHONPATH=. python -m uvicorn backend.main:app --host 127.0.0.1 --port 8090
```

- `GET /health`
- `GET /api/status`
- `POST /api/detect` with multipart field `file`

The class reported by the checkpoint is passed through. The project expects that class to be `infected`.
