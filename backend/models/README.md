# Trained weights

Place the selected YOLO26 checkpoint here as `best.pt`.

The service loads only this file (or the path in `MODEL_PATH`). It does not download or substitute a generic pretrained model.

Restart the detection service after changing the file if a previous load failed because Ultralytics was missing. A newly added `best.pt` is picked up on the next request when the runtime is already installed.
