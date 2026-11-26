import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Download,
  Loader2,
  Radio,
  RefreshCw,
  ScanSearch,
  Square,
  TriangleAlert,
} from "lucide-react";
import {
  CONFIDENCE_THRESHOLD_STEP,
  DEFAULT_CONFIDENCE_THRESHOLD,
  MAX_CONFIDENCE_THRESHOLD,
  MIN_CONFIDENCE_THRESHOLD,
  formatConfidence,
  formatThreshold,
  type DetectResponse,
  type Detection,
  type FrameDetectResponse,
} from "@/lib/detection";

type FacingMode = "environment" | "user";

type CaptureResult = {
  originalUrl: string;
  annotatedUrl: string;
  total: number;
  detections: Detection[];
  thresholdUsed: number;
};

const LIVE_INTERVAL_OPTIONS = [
  { value: 500, label: "500 ms (Responsive)" },
  { value: 750, label: "750 ms (Balanced)" },
  { value: 1000, label: "1000 ms (Low load)" },
  { value: 1500, label: "1500 ms (Battery saver)" },
];

export function CameraDetectionPanel() {
  const sliderId = useId();
  const intervalId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureResultRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveTimerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<FacingMode>("user");
  const [liveActive, setLiveActive] = useState(false);
  const [liveIntervalMs, setLiveIntervalMs] = useState<number>(750);
  const [modelMode, setModelMode] = useState<"e3" | "e2" | "compare">("e3");
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(DEFAULT_CONFIDENCE_THRESHOLD);
  const [liveDetections, setLiveDetections] = useState<Detection[]>([]);
  const [liveCompareCounts, setLiveCompareCounts] = useState<{ e2: number; e3: number; e2Ms: number; e3Ms: number } | null>(null);
  const [lastInferenceMs, setLastInferenceMs] = useState<number | null>(null);
  const [captureRunning, setCaptureRunning] = useState(false);
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopTracks = useCallback(() => {
    if (liveTimerRef.current !== null) {
      window.clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    setLiveActive(false);
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext("2d");
      ctx?.clearRect(0, 0, overlay.width, overlay.height);
    }
    setCameraActive(false);
    setLiveDetections([]);
    setLastInferenceMs(null);
  }, []);

  useEffect(() => {
    return () => {
      stopTracks();
    };
  }, [stopTracks]);

  function drawOverlay(
    detections: Detection[],
    frameW: number,
    frameH: number,
    color = "#e85d04",
    prefix = "",
    clearFirst = true,
  ) {
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const displayW = video.clientWidth;
    const displayH = video.clientHeight;
    if (displayW <= 0 || displayH <= 0 || frameW <= 0 || frameH <= 0) return;

    if (clearFirst) {
      canvas.width = displayW;
      canvas.height = displayH;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (clearFirst) ctx.clearRect(0, 0, displayW, displayH);

    // Match object-contain scaling
    const scale = Math.min(displayW / frameW, displayH / frameH);
    const renderedW = frameW * scale;
    const renderedH = frameH * scale;
    const offsetX = (displayW - renderedW) / 2;
    const offsetY = (displayH - renderedH) / 2;

    ctx.lineWidth = 2.5;
    ctx.font = "600 12px system-ui, -apple-system, sans-serif";

    for (const det of detections) {
      const [x1, y1, x2, y2] = det.bbox;
      const rawSx1 = offsetX + x1 * scale;
      const rawSx2 = offsetX + x2 * scale;
      const sx1 = facingMode === "user" ? displayW - rawSx2 : rawSx1;
      const sy1 = offsetY + y1 * scale;
      const sw = (x2 - x1) * scale;
      const sh = (y2 - y1) * scale;

      ctx.strokeStyle = color;
      ctx.strokeRect(sx1, sy1, sw, sh);

      const label = `${prefix}${det.class} ${(det.confidence * 100).toFixed(1)}%`;
      const metrics = ctx.measureText(label);
      const padX = 6;
      const boxH = 20;
      const labelY = Math.max(0, sy1 - boxH);

      ctx.fillStyle = color;
      ctx.fillRect(sx1, labelY, metrics.width + padX * 2, boxH);
      ctx.fillStyle = color === "#14746f" ? "#ffffff" : "#17261e";
      ctx.fillText(label, sx1 + padX, labelY + 14);
    }
  }

  async function startCamera(targetFacing: FacingMode = facingMode) {
    if (starting) return;
    setError(null);

    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError("Camera access requires a secure context (HTTPS or localhost).");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support camera access (MediaDevices API unavailable).");
      return;
    }

    stopTracks();
    setStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: targetFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFacingMode(targetFacing);
      setCameraActive(true);
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Camera permission was denied. Allow camera access in your browser settings and try again.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("No camera device was found on this device.");
      } else if (name === "NotReadableError" || name === "TrackStartError") {
        setError("The camera is currently in use by another application.");
      } else {
        setError("Unable to start the camera. Check device permissions and HTTPS connection.");
      }
      stopTracks();
    } finally {
      setStarting(false);
    }
  }

  async function switchCamera() {
    const nextFacing: FacingMode = facingMode === "environment" ? "user" : "environment";
    await startCamera(nextFacing);
  }

  function grabFrameBlob(maxSide = 960): Promise<{ blob: Blob; dataUrl: string } | null> {
    const video = videoRef.current;
    if (!video || video.videoWidth < 2 || video.videoHeight < 2) return Promise.resolve(null);

    let canvas = captureCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      captureCanvasRef.current = canvas;
    }

    const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return Promise.resolve(null);
    ctx.save();
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return new Promise((resolve) => {
      canvas!.toBlob(
        (blob) => {
          if (!blob) resolve(null);
          else resolve({ blob, dataUrl });
        },
        "image/jpeg",
        0.85,
      );
    });
  }

  const sendLiveFrame = useCallback(async () => {
    if (inFlightRef.current || !streamRef.current) return;
    inFlightRef.current = true;
    try {
      const frame = await grabFrameBlob(960);
      if (!frame) return;
      const body = new FormData();
      body.append("file", new File([frame.blob], "camera-frame.jpg", { type: "image/jpeg" }));
      body.append("confidence_threshold", confidenceThreshold.toFixed(2));
      body.append("model_mode", modelMode);

      const response = await fetch("/api/detect/frame", { method: "POST", body });
      const payload = (await response.json()) as FrameDetectResponse;
      if (!payload.success) {
        setError(payload.message || "Live frame detection failed.");
        return;
      }
      setError(null);
      setLastInferenceMs(payload.inference_ms);
      if (payload.model_mode === "compare" && payload.e2 && payload.e3) {
        setLiveCompareCounts({
          e2: payload.e2.total_detections,
          e3: payload.e3.total_detections,
          e2Ms: payload.e2.inference_ms,
          e3Ms: payload.e3.inference_ms,
        });
        setLiveDetections(payload.e3.detections);
        drawOverlay(payload.e2.detections, payload.frame_width, payload.frame_height, "#14746f", "[E2] ", true);
        drawOverlay(payload.e3.detections, payload.frame_width, payload.frame_height, "#e85d04", "[E3] ", false);
      } else {
        setLiveCompareCounts(null);
        setLiveDetections(payload.detections);
        drawOverlay(
          payload.detections,
          payload.frame_width,
          payload.frame_height,
          modelMode === "e2" ? "#14746f" : "#e85d04",
          modelMode === "e2" ? "[E2] " : "",
          true,
        );
      }
    } catch {
      setError("Detection service could not be reached during live detection.");
    } finally {
      inFlightRef.current = false;
    }
  }, [confidenceThreshold, modelMode]);

  useEffect(() => {
    if (!liveActive || !cameraActive) {
      if (liveTimerRef.current !== null) {
        window.clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }
      return;
    }
    void sendLiveFrame();
    liveTimerRef.current = window.setInterval(() => {
      void sendLiveFrame();
    }, liveIntervalMs);
    return () => {
      if (liveTimerRef.current !== null) {
        window.clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }
    };
  }, [liveActive, cameraActive, liveIntervalMs, sendLiveFrame]);

  async function captureAndAnalyze() {
    if (!cameraActive || captureRunning) return;
    setCaptureRunning(true);
    setError(null);
    try {
      const frame = await grabFrameBlob(1280);
      if (!frame) {
        setError("Unable to capture frame from camera.");
        return;
      }
      const body = new FormData();
      body.append("file", new File([frame.blob], "camera-capture.jpg", { type: "image/jpeg" }));
      body.append("confidence_threshold", confidenceThreshold.toFixed(2));
      body.append("model_mode", modelMode === "e2" ? "e2" : "e3");
      const response = await fetch("/api/detect", { method: "POST", body });
      const payload = (await response.json()) as DetectResponse;
      if (!payload.success) {
        setError(payload.message || "Unable to analyze captured image.");
        return;
      }
      const mime = payload.annotated_mime || "image/jpeg";
      setCaptureResult({
        originalUrl: frame.dataUrl,
        annotatedUrl: `data:${mime};base64,${payload.annotated_image}`,
        total: payload.total_detections,
        detections: payload.detections,
        thresholdUsed:
          typeof payload.confidence_threshold === "number"
            ? payload.confidence_threshold
            : confidenceThreshold,
      });
      window.setTimeout(() => {
        captureResultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    } catch {
      setError("The detection service could not be reached.");
    } finally {
      setCaptureRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-accent bg-surface px-4 py-3 text-sm text-ink"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <section className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-sm font-semibold text-ink">
                Live Camera ({facingMode === "user" ? "Mirror / Front" : "Rear"})
              </span>
              <span
                className={
                  liveActive
                    ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
                    : cameraActive
                      ? "inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-ink"
                      : "inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-xs font-medium text-muted"
                }
              >
                {liveActive ? (
                  <>
                    <Radio className="size-3.5 animate-pulse" aria-hidden="true" />
                    Live · {liveDetections.length} box{liveDetections.length === 1 ? "" : "es"}
                    {lastInferenceMs !== null ? ` · ${lastInferenceMs}ms` : ""}
                  </>
                ) : cameraActive ? (
                  "Camera ready"
                ) : (
                  "Camera off"
                )}
              </span>
            </div>

            <div className="relative flex min-h-72 items-center justify-center bg-canvas">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : undefined }}
                className={cameraActive ? "max-h-[54vh] w-full object-contain" : "hidden"}
              />
              <canvas
                ref={overlayCanvasRef}
                className="pointer-events-none absolute inset-0 h-full w-full"
              />
              {!cameraActive ? (
                <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-surface text-primary shadow-sm">
                    <Camera className="size-6" aria-hidden="true" />
                  </span>
                  <p className="font-display text-2xl text-ink">Mirror Camera Detection</p>
                  <p className="max-w-md text-sm leading-relaxed text-muted">
                    Start your camera to inspect corn leaves in real time (mirrored view by default) or capture a still
                    frame.
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {captureResult ? (
            <div ref={captureResultRef} className="grid gap-4 sm:grid-cols-2">
              <figure className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <figcaption className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
                  Captured original
                </figcaption>
                <img src={captureResult.originalUrl} alt="Captured leaf frame" className="w-full object-contain" />
              </figure>
              <figure className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <figcaption className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
                  <span>Annotated capture ({captureResult.total})</span>
                  <a
                    href={captureResult.annotatedUrl}
                    download="faw-camera-annotated.jpg"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <Download className="size-3.5" aria-hidden="true" />
                    Save
                  </a>
                </figcaption>
                <img src={captureResult.annotatedUrl} alt="Annotated capture" className="w-full object-contain" />
              </figure>
            </div>
          ) : null}
        </section>

        <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-4">
          <div className="flex flex-col gap-2">
            {!cameraActive ? (
              <button
                type="button"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                onClick={() => void startCamera(facingMode)}
                disabled={starting}
              >
                {starting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Camera className="size-4" aria-hidden="true" />}
                {starting ? "Starting Camera..." : "Start Camera"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={
                    liveActive
                      ? "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
                      : "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  }
                  onClick={() => setLiveActive((prev) => !prev)}
                >
                  {liveActive ? <Square className="size-4" aria-hidden="true" /> : <Radio className="size-4" aria-hidden="true" />}
                  {liveActive ? "Stop Live Detection" : "Start Live Detection"}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-3 text-xs font-semibold text-ink hover:bg-surface disabled:opacity-50"
                    onClick={() => void captureAndAnalyze()}
                    disabled={captureRunning}
                  >
                    {captureRunning ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <ScanSearch className="size-3.5" aria-hidden="true" />}
                    Capture
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-3 text-xs font-semibold text-ink hover:bg-surface"
                    onClick={() => void switchCamera()}
                  >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    Switch
                  </button>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-semibold text-ink hover:bg-canvas"
                  onClick={stopTracks}
                >
                  <CameraOff className="size-3.5" aria-hidden="true" />
                  Stop Camera
                </button>
              </>
            )}
          </div>

          <div className="rounded-2xl bg-canvas p-3">
            <span className="block text-xs font-semibold tracking-wider text-muted uppercase">Model Selection</span>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: "e3" as const, label: "E3 (Prod)" },
                  { id: "e2" as const, label: "E2 (Exp 2)" },
                  { id: "compare" as const, label: "E2 & E3" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setModelMode(opt.id)}
                  className={
                    modelMode === opt.id
                      ? "rounded-xl border-2 border-primary bg-surface px-2 py-2 text-xs font-semibold text-primary shadow-xs"
                      : "rounded-xl border border-line bg-surface/60 px-2 py-2 text-xs font-medium text-ink hover:border-primary/40"
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {modelMode === "compare" ? (
              <p className="mt-2 text-[11px] text-accent">
                Running E2 &amp; E3 simultaneously increases latency and reduces FPS.
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl bg-canvas p-3">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={sliderId} className="text-xs font-semibold text-ink">
                Confidence Threshold
              </label>
              <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
                {formatThreshold(confidenceThreshold)}
              </span>
            </div>
            <input
              id={sliderId}
              type="range"
              min={MIN_CONFIDENCE_THRESHOLD}
              max={MAX_CONFIDENCE_THRESHOLD}
              step={CONFIDENCE_THRESHOLD_STEP}
              value={confidenceThreshold}
              onChange={(event) => setConfidenceThreshold(Number(event.target.value))}
              className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary"
            />
          </div>

          <div className="rounded-2xl bg-canvas p-3">
            <label htmlFor={intervalId} className="block text-xs font-semibold text-ink">
              Live Detection Interval
            </label>
            <select
              id={intervalId}
              value={liveIntervalMs}
              onChange={(event) => setLiveIntervalMs(Number(event.target.value))}
              className="mt-1.5 h-9 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-medium text-ink"
            >
              {LIVE_INTERVAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="border-t border-line pt-3">
            <p className="text-[11px] font-semibold tracking-widest text-muted uppercase">
              {liveActive ? "Live Detections" : captureResult ? "Captured Frame" : "Camera Status"}
            </p>
            <p className="mt-0.5 font-display text-4xl leading-none text-ink tabular-nums">
              {liveActive ? liveDetections.length : captureResult ? captureResult.total : 0}
            </p>
            {liveCompareCounts && liveActive ? (
              <p className="mt-1 text-xs font-medium text-ink tabular-nums">
                E2: {liveCompareCounts.e2} ({liveCompareCounts.e2Ms} ms) · E3: {liveCompareCounts.e3} (
                {liveCompareCounts.e3Ms} ms)
              </p>
            ) : null}
          </div>

          {(liveActive ? liveDetections : captureResult?.detections || []).length > 0 ? (
            <ol className="flex max-h-44 flex-col gap-1.5 overflow-auto">
              {(liveActive ? liveDetections : captureResult?.detections || []).map((det, idx) => (
                <li key={`${det.bbox.join("-")}-${idx}`} className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-xs">
                  <span className="font-semibold text-ink">
                    {idx + 1}. {det.class}
                  </span>
                  <span className="font-semibold text-primary tabular-nums">{formatConfidence(det.confidence)}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
