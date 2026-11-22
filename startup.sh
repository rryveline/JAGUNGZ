#!/bin/sh
set -eu
cd /workspace

# The live preview attaches to whatever HTTP server it finds. Keep the
# inference runtime off the network so the preview stays on the web app.
# Detection is invoked in-process via `python -m backend.cli`.

if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:8080/; then
  exit 0
fi

npm run dev >> /tmp/faw-web.log 2>&1 &
