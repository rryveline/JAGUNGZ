# Corn Leaf FAW Detection

Web app for a computer-vision project that looks for suspected Fall Armyworm damage on **corn leaves**. The interface uploads a photo, sends it to a FastAPI inference service, and shows the original image, an annotated copy, class labels, confidence scores, and the detection count.

The only class is `infected`. The app does not diagnose other diseases and does not call a leaf healthy when nothing is found.

## What you need before real detections

The trained YOLO26 checkpoint is not included.

1. Install the Python dependencies in `backend/requirements.txt` (use the same PyTorch and Ultralytics versions as training).
2. Copy the selected weights to `backend/models/best.pt`, or set `MODEL_PATH`.
3. Set `CONFIDENCE_THRESHOLD` after validation. `0.25` is only a placeholder.
4. Start the inference service, then the web app.

If `best.pt` is missing, detection returns an error. A generic pretrained model is never downloaded or substituted, and the interface never invents boxes.

## Layout

```text
backend/                 FastAPI + YOLO26 inference
  core/config.py         model path, confidence, upload limit
  services/inference.py  load weights once, predict
  services/image_processing.py
  routes/detection.py    GET /api/status, POST /api/detect
  models/best.pt         put the trained checkpoint here
src/                     web interface
```

The page calls same-origin `/api/detect` and `/api/status`. Those routes forward to the FastAPI service.

## Run the inference service

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
PYTHONPATH=. python -m uvicorn backend.main:app --host 127.0.0.1 --port 8090
```

Check `GET /api/status`. `model_ready` should be true after the weights load.

## Run the web app

```bash
npm install
npm run dev
```

The dev server listens on port 8080 and proxies detection to `INFERENCE_URL` (default `http://127.0.0.1:8090`).

## API

`POST /api/detect` · `multipart/form-data` · field name `file`

```json
{
  "success": true,
  "total_detections": 1,
  "detections": [
    { "class": "infected", "confidence": 0.92, "bbox": [120, 80, 240, 190] }
  ],
  "annotated_image": "<base64 jpeg>",
  "annotated_mime": "image/jpeg"
}
```

Boxes are `[x1, y1, x2, y2]` in pixels on the annotated image. The original upload is not modified.

Failures use `success: false` and `message`, with HTTP 400 (bad or unreadable image), 413 (too large), 503 (weights or runtime missing), or 500 (inference error).

## Settings

See `.env.example`.

| Variable | Purpose |
|---|---|
| `MODEL_PATH` | Checkpoint file. Default `backend/models/best.pt`. |
| `CONFIDENCE_THRESHOLD` | Predict `conf`. Placeholder `0.25` until evaluation. |
| `IOU_THRESHOLD` | Optional. Omitted unless set. |
| `MAX_UPLOAD_BYTES` | Default 10 MB. JPG and PNG only. |
| `INFERENCE_URL` | Where the web app sends uploads. |

## Replacing the checkpoint

Put the new file at `backend/models/best.pt`. The service reloads when the file size or modification time changes. If Ultralytics was not installed on the previous attempt, restart the service after installing it.

Do not point `MODEL_PATH` at a stock model name such as `yolo26n.pt`. The loader only opens a real file on disk.

## Limits

- Corn leaves, class `infected` only.
- No accounts, history, or treatment advice.
- Hosted deployments that cannot run the Python service will show the service as offline instead of fake results.
- Final confidence and the chosen YOLO26 experiment still have to come from your evaluation.
