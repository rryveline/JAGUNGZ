import { useEffect, useId, useRef, useState } from "react";
import { Clock, Download, Film, Loader2, Play, RotateCcw, TriangleAlert, Upload } from "lucide-react";
import {
  CONFIDENCE_THRESHOLD_STEP,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_MAX_VIDEO_UPLOAD_BYTES,
  MAX_CONFIDENCE_THRESHOLD,
  MIN_CONFIDENCE_THRESHOLD,
  formatBytes,
  formatConfidence,
  formatThreshold,
  validateLeafVideo,
  type ServiceStatus,
  type VideoDetectResult,
  type VideoJobProgress,
} from "@/lib/detection";

type VideoPhase = "empty" | "ready" | "running" | "done";

const SAMPLE_INTERVAL_OPTIONS = [
  { value: 0.25, label: "0.25s (High detail)" },
  { value: 0.5, label: "0.50s (Balanced)" },
  { value: 1.0, label: "1.00s (Fast)" },
  { value: 2.0, label: "2.00s (Quick scan)" },
];

export function VideoDetectionPanel({ status }: { status: ServiceStatus | null }) {
  const inputId = useId();
  const sliderId = useId();
  const intervalId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const annotatedVideoRef = useRef<HTMLVideoElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [phase, setPhase] = useState<VideoPhase>("empty");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(DEFAULT_CONFIDENCE_THRESHOLD);
  const [sampleInterval, setSampleInterval] = useState<number>(0.5);
  const [modelMode, setModelMode] = useState<"e3" | "e2" | "compare">("e3");
  const [progress, setProgress] = useState<VideoJobProgress | null>(null);
  const [result, setResult] = useState<VideoDetectResult | null>(null);

  const maxVideoBytes = status?.max_video_upload_bytes || DEFAULT_MAX_VIDEO_UPLOAD_BYTES;

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  function replacePreview(next: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next;
    setPreviewUrl(next);
  }

  function resetAll() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    replacePreview(null);
    setFile(null);
    setProgress(null);
    setResult(null);
    setError(null);
    setPhase("empty");
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function acceptVideo(next: File | undefined) {
    if (!next) {
      setError("No video file is selected.");
      return;
    }
    const problem = validateLeafVideo(next, maxVideoBytes);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setResult(null);
    setProgress(null);
    replacePreview(URL.createObjectURL(next));
    setFile(next);
    setPhase("ready");
  }

  async function fetchJobResult(jobId: string) {
    const res = await fetch(`/api/detect/video/${jobId}/result`);
    const payload = (await res.json()) as VideoDetectResult | { success: false; message: string };
    if (!payload.success) {
      setError(payload.message || "Unable to load video analysis results.");
      setPhase("ready");
      return;
    }
    setResult(payload);
    setPhase("done");
  }

  function pollJobFallback(jobId: string) {
    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/detect/video/${jobId}`);
        const data = (await res.json()) as VideoJobProgress;
        setProgress(data);
        if (data.status === "completed") {
          window.clearInterval(timer);
          await fetchJobResult(jobId);
        } else if (data.status === "failed") {
          window.clearInterval(timer);
          setError(data.message || "Video analysis failed.");
          setPhase("ready");
        }
      } catch {
        window.clearInterval(timer);
        setError("Lost connection while checking video analysis progress.");
        setPhase("ready");
      }
    }, 600);
  }

  async function onStartAnalysis() {
    if (!file || phase === "running") return;
    setPhase("running");
    setError(null);
    setResult(null);
    setProgress({
      success: true,
      job_id: "",
      status: "queued",
      percent: 0,
      processed_frames: 0,
      total_frames: 0,
      detections_so_far: 0,
      message: "Uploading video for analysis...",
    });

    try {
      const body = new FormData();
      body.append("file", file);
      body.append("confidence_threshold", confidenceThreshold.toFixed(2));
      body.append("sample_interval_sec", String(sampleInterval));
      body.append("model_mode", modelMode);

      const response = await fetch("/api/detect/video", { method: "POST", body });
      const payload = (await response.json()) as { success: boolean; job_id?: string; message?: string };
      if (!payload.success || !payload.job_id) {
        setError(payload.message || "Unable to start video analysis.");
        setPhase("ready");
        return;
      }

      const jobId = payload.job_id;
      if (typeof EventSource !== "undefined") {
        const es = new EventSource(`/api/detect/video/${jobId}`);
        eventSourceRef.current = es;
        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as VideoJobProgress;
            setProgress(data);
            if (data.status === "completed") {
              es.close();
              eventSourceRef.current = null;
              void fetchJobResult(jobId);
            } else if (data.status === "failed") {
              es.close();
              eventSourceRef.current = null;
              setError(data.message || "Video analysis failed.");
              setPhase("ready");
            }
          } catch {
            // Ignore malformed SSE event.
          }
        };
        es.onerror = () => {
          es.close();
          eventSourceRef.current = null;
          pollJobFallback(jobId);
        };
      } else {
        pollJobFallback(jobId);
      }
    } catch {
      setError("The detection service could not be reached.");
      setPhase("ready");
    }
  }

  function seekToTimestamp(ms: number) {
    const videoEl = annotatedVideoRef.current;
    if (!videoEl) return;
    videoEl.currentTime = Math.max(0, ms / 1000);
    void videoEl.play().catch(() => undefined);
  }

  return (
    <div className="flex flex-col gap-5">
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
          {phase === "done" && result ? (
            <div className="grid gap-4 md:grid-cols-2">
              {previewUrl ? (
                <figure className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                  <figcaption className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
                    Original video
                  </figcaption>
                  <video src={previewUrl} controls playsInline className="max-h-[50vh] w-full bg-canvas object-contain" />
                </figure>
              ) : null}
              <figure className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                <figcaption className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
                  Annotated video result
                </figcaption>
                <video
                  ref={annotatedVideoRef}
                  src={`${result.video_url}?inline=1`}
                  controls
                  playsInline
                  className="max-h-[50vh] w-full bg-canvas object-contain"
                />
              </figure>
            </div>
          ) : previewUrl && file ? (
            <figure className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
              <figcaption className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">
                Video preview · {file.name} ({formatBytes(file.size)})
              </figcaption>
              <video src={previewUrl} controls playsInline className="max-h-[52vh] w-full bg-canvas object-contain" />
            </figure>
          ) : (
            <div
              className={
                dragging
                  ? "flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-primary/5 px-6 py-10 text-center"
                  : "flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-line bg-surface px-6 py-10 text-center"
              }
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragging(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                acceptVideo(event.dataTransfer.files?.[0]);
              }}
            >
              <span className="flex size-14 items-center justify-center rounded-2xl bg-canvas text-primary">
                <Film className="size-6" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-2xl text-ink">Upload a corn leaf video</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  MP4, MOV, AVI, or WEBM up to {Math.max(1, Math.round(maxVideoBytes / (1024 * 1024)))} MB (max 2 minutes).
                </p>
              </div>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
                onClick={() => inputRef.current?.click()}
                aria-controls={inputId}
              >
                <Upload className="size-4" aria-hidden="true" />
                Browse video
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            id={inputId}
            className="sr-only"
            type="file"
            accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm"
            onChange={(event) => {
              const next = event.target.files?.[0];
              event.target.value = "";
              acceptVideo(next);
            }}
          />

          {phase === "running" && progress ? (
            <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-ink">{progress.message}</span>
                <span className="font-semibold text-primary tabular-nums">{progress.percent}%</span>
              </div>
              <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.max(4, progress.percent)}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted tabular-nums">
                Sampled frames: {progress.processed_frames} / {progress.total_frames || "?"} · Detections found:{" "}
                {progress.detections_so_far}
              </p>
            </div>
          ) : null}
        </section>

        <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-4">
          {phase !== "done" ? (
            <>
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
                      disabled={phase === "running"}
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
                  disabled={phase === "running"}
                  onChange={(event) => setConfidenceThreshold(Number(event.target.value))}
                  className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary disabled:opacity-50"
                />
              </div>

              <div className="rounded-2xl bg-canvas p-3">
                <label htmlFor={intervalId} className="block text-xs font-semibold text-ink">
                  Frame Sampling Interval
                </label>
                <select
                  id={intervalId}
                  value={sampleInterval}
                  disabled={phase === "running"}
                  onChange={(event) => setSampleInterval(Number(event.target.value))}
                  className="mt-2 h-9 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-medium text-ink"
                >
                  {SAMPLE_INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {file && previewUrl ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    onClick={() => void onStartAnalysis()}
                    disabled={phase === "running"}
                  >
                    {phase === "running" ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <Play className="size-4" aria-hidden="true" />
                    )}
                    {phase === "running" ? "Analyzing..." : "Mulai Analisis"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-4 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-50"
                    onClick={resetAll}
                    disabled={phase === "running"}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reset
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="size-4" aria-hidden="true" />
                  Browse video
                </button>
              )}
            </>
          ) : null}

          {phase === "done" && result ? (
            <>
              <div>
                <p className="text-xs font-semibold tracking-widest text-muted uppercase">Detection Summary</p>
                <p className="mt-1 font-display text-5xl leading-none text-ink tabular-nums">
                  {result.total_detections}
                </p>
                <p className="mt-1 text-xs text-muted">Total detections across sampled frames</p>
              </div>

              <dl className="grid grid-cols-2 gap-2.5 text-sm">
                <div className="rounded-2xl bg-canvas px-3 py-2.5">
                  <dt className="text-xs text-muted">Method</dt>
                  <dd className="mt-0.5 font-semibold text-ink capitalize">{result.detection_method}</dd>
                </div>
                <div className="rounded-2xl bg-canvas px-3 py-2.5">
                  <dt className="text-xs text-muted">Threshold</dt>
                  <dd className="mt-0.5 font-semibold text-ink tabular-nums">
                    {formatThreshold(result.confidence_threshold)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-canvas px-3 py-2.5">
                  <dt className="text-xs text-muted">Frames Analyzed</dt>
                  <dd className="mt-0.5 font-semibold text-ink tabular-nums">{result.total_frames_analyzed}</dd>
                </div>
                <div className="rounded-2xl bg-canvas px-3 py-2.5">
                  <dt className="text-xs text-muted">Frames w/ Detection</dt>
                  <dd className="mt-0.5 font-semibold text-ink tabular-nums">{result.frames_with_detection}</dd>
                </div>
                <div className="rounded-2xl bg-canvas px-3 py-2.5">
                  <dt className="text-xs text-muted">Class</dt>
                  <dd className="mt-0.5 font-semibold text-ink">{result.detection_class}</dd>
                </div>
                <div className="rounded-2xl bg-canvas px-3 py-2.5">
                  <dt className="text-xs text-muted">Avg Confidence</dt>
                  <dd className="mt-0.5 font-semibold text-ink tabular-nums">
                    {result.total_detections > 0 ? formatConfidence(result.average_confidence) : "—"}
                  </dd>
                </div>
              </dl>

              {result.model_mode === "compare" && result.e2_summary && result.e3_summary ? (
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-2xl border border-[#14746f]/30 bg-canvas p-3">
                    <p className="font-semibold text-[#14746f]">E2 (e2best.pt)</p>
                    <p className="mt-1 tabular-nums text-ink">{result.e2_summary.total_detections} detections</p>
                    <p className="tabular-nums text-muted">{result.e2_summary.avg_inference_ms} ms/frame</p>
                  </div>
                  <div className="rounded-2xl border border-primary/30 bg-canvas p-3">
                    <p className="font-semibold text-primary">E3 (best.pt)</p>
                    <p className="mt-1 tabular-nums text-ink">{result.e3_summary.total_detections} detections</p>
                    <p className="tabular-nums text-muted">{result.e3_summary.avg_inference_ms} ms/frame</p>
                  </div>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-semibold tracking-widest text-muted uppercase">Detection Timeline</p>
                {result.timeline.length === 0 ? (
                  <div className="mt-2 rounded-2xl bg-canvas px-4 py-3 text-sm text-muted">
                    No suspected damage detected across {result.total_frames_analyzed} sampled frames.
                  </div>
                ) : (
                  <ol className="mt-2 flex max-h-60 flex-col gap-2 overflow-auto">
                    {result.timeline.map((entry) => (
                      <li key={`${entry.frame_index}-${entry.timestamp_ms}`}>
                        <button
                          type="button"
                          onClick={() => seekToTimestamp(entry.timestamp_ms)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5 text-left text-sm transition-colors hover:bg-primary/10"
                        >
                          <span className="inline-flex items-center gap-1.5 font-semibold text-ink tabular-nums">
                            <Clock className="size-3.5 text-primary" aria-hidden="true" />
                            {entry.timestamp}
                          </span>
                          <span className="text-xs text-muted">
                            {result.detection_class} ({entry.detections_count}) · {formatConfidence(entry.max_confidence)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <a
                href={result.video_url}
                download={result.output_filename}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                <Download className="size-4" aria-hidden="true" />
                Download annotated video
              </a>
              <button
                type="button"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-canvas"
                onClick={resetAll}
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Analyze another video
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold tracking-widest text-muted uppercase">Video Pipeline</p>
              <h2 className="font-display text-2xl text-ink">
                {file ? file.name : "Waiting for a video"}
              </h2>
              <p className="text-sm leading-relaxed text-muted">
                Frames are sampled periodically and analyzed with the trained YOLO26 model (`best.pt`). Detected areas
                indicate suspected leaf damage (`infected`), not a definitive pest species diagnosis.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
