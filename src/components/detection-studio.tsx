import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  Download,
  Film,
  Image as ImageIcon,
  Leaf,
  Loader2,
  RotateCcw,
  ScanSearch,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CameraDetectionPanel } from "@/components/camera-detection-panel";
import { VideoDetectionPanel } from "@/components/video-detection-panel";
import {
  CONFIDENCE_THRESHOLD_STEP,
  DEFAULT_CONFIDENCE_THRESHOLD,
  DEFAULT_MAX_UPLOAD_BYTES,
  MAX_CONFIDENCE_THRESHOLD,
  MIN_CONFIDENCE_THRESHOLD,
  formatBytes,
  formatConfidence,
  formatThreshold,
  validateLeafImage,
  type CompareResponse,
  type DetectResponse,
  type ModelSideResult,
  type ServiceStatus,
} from "@/lib/detection";

type DetectionMode = "image" | "video" | "camera";
type ModelMode = "e3" | "e2" | "compare";
type Phase = "empty" | "ready" | "running" | "done";

type SingleResultView = {
  kind: "single";
  modelMode: "e2" | "e3";
  total: number;
  thresholdUsed: number;
  detections: Extract<DetectResponse, { success: true }>["detections"];
  annotatedUrl: string;
};

type CompareResultView = {
  kind: "compare";
  data: Extract<CompareResponse, { success: true }>;
};

type ResultView = SingleResultView | CompareResultView;

function isStatus(value: unknown): value is ServiceStatus {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.message === "string" && typeof record.model_ready === "boolean";
}

export function DetectionStudio() {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [mode, setMode] = useState<DetectionMode>("image");
  const [modelMode, setModelMode] = useState<ModelMode>("e3");
  const [phase, setPhase] = useState<Phase>("empty");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultView | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(DEFAULT_CONFIDENCE_THRESHOLD);

  const maxBytes = status?.max_upload_bytes || DEFAULT_MAX_UPLOAD_BYTES;

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const response = await fetch("/api/status");
        const payload: unknown = await response.json();
        if (!cancelled && isStatus(payload)) setStatus(payload);
      } catch {
        if (!cancelled) {
          setStatus({
            service: "unavailable",
            model_ready: false,
            class_name: "infected",
            confidence_threshold: null,
            max_upload_bytes: DEFAULT_MAX_UPLOAD_BYTES,
            weights_hint: "backend/models/best.pt",
            message: "The detection service could not be reached.",
          });
        }
      }
    }
    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  function replacePreview(next: string | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = next;
    setPreviewUrl(next);
  }

  function resetAll() {
    replacePreview(null);
    setFile(null);
    setResult(null);
    setError(null);
    setPhase("empty");
    setDragging(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function acceptFile(next: File | undefined) {
    if (!next) {
      setError("No file is selected.");
      return;
    }
    const problem = await validateLeafImage(next, maxBytes);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setResult(null);
    replacePreview(URL.createObjectURL(next));
    setFile(next);
    setPhase("ready");
  }

  async function onDetect() {
    if (!file || phase === "running") return;
    setPhase("running");
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("confidence_threshold", confidenceThreshold.toFixed(2));

      if (modelMode === "compare") {
        const response = await fetch("/api/detect/compare", { method: "POST", body });
        const payload = (await response.json()) as CompareResponse;
        if (!payload.success) {
          setError(payload.message || "Unable to compare models on the uploaded image.");
          setPhase(result ? "done" : "ready");
          return;
        }
        setResult({ kind: "compare", data: payload });
        setPhase("done");
        return;
      }

      body.append("model_mode", modelMode);
      const response = await fetch("/api/detect", { method: "POST", body });
      const payload = (await response.json()) as DetectResponse;
      if (!payload.success) {
        setError(payload.message || "Unable to process the uploaded image.");
        setPhase(result ? "done" : "ready");
        return;
      }
      const mime = payload.annotated_mime || "image/jpeg";
      setResult({
        kind: "single",
        modelMode,
        total: payload.total_detections,
        thresholdUsed:
          typeof payload.confidence_threshold === "number"
            ? payload.confidence_threshold
            : confidenceThreshold,
        detections: payload.detections,
        annotatedUrl: `data:${mime};base64,${payload.annotated_image}`,
      });
      setPhase("done");
    } catch {
      setError("The detection service could not be reached. Nothing was inferred locally in the browser.");
      setPhase(result ? "done" : "ready");
    }
  }

  function downloadUrl(url: string, filename: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  }

  const showDone = (phase === "done" || (phase === "running" && result !== null)) && result && previewUrl;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="group inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-canvas px-3.5 text-xs font-semibold text-ink transition-colors duration-200 hover:border-primary hover:text-primary"
            >
              <ArrowLeft className="size-3.5 transition-transform duration-300 ease-out group-hover:-translate-x-1" aria-hidden="true" />
              Home
            </Link>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Leaf className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-display text-2xl leading-none font-semibold text-ink sm:text-3xl">
                <Link to="/">JAGUNGZ</Link>
              </h1>
              <p className="text-xs text-muted">Corn Leaf Pest Detection Studio</p>
            </div>
          </div>
          <StatusPill status={status} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
        <nav aria-label="Detection method" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(
            [
              {
                id: "image" as const,
                title: "Image Detection",
                subtitle: "Upload photo · E2 / E3 / Compare",
                icon: ImageIcon,
              },
              {
                id: "video" as const,
                title: "Video Detection",
                subtitle: "Analyze frames & timestamps",
                icon: Film,
              },
              {
                id: "camera" as const,
                title: "Live Camera",
                subtitle: "Mirror webcam or phone scan",
                icon: Camera,
              },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(tab.id)}
                className={
                  active
                    ? "flex items-center gap-3 rounded-2xl border-2 border-primary bg-surface px-4 py-2.5 text-left shadow-sm transition-colors"
                    : "flex items-center gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-surface"
                }
              >
                <span
                  className={
                    active
                      ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                      : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-primary"
                  }
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{tab.title}</span>
                  <span className="block truncate text-xs text-muted">{tab.subtitle}</span>
                </span>
              </button>
            );
          })}
        </nav>

        {mode === "video" ? (
          <VideoDetectionPanel status={status} />
        ) : mode === "camera" ? (
          <CameraDetectionPanel />
        ) : (
          <>
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-2xl border border-accent bg-surface px-4 py-3 text-sm text-ink"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <p>{error}</p>
              </div>
            ) : null}

            <input
              ref={inputRef}
              id={inputId}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              onChange={(event) => {
                const next = event.target.files?.[0];
                event.target.value = "";
                void acceptFile(next);
              }}
            />

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
              <section className="flex flex-col gap-4">
                {showDone && result.kind === "single" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <ImageFrame title="Original image" src={previewUrl} alt="Uploaded corn leaf" />
                    <ImageFrame
                      title={`Detection result (${result.modelMode.toUpperCase()})`}
                      src={result.annotatedUrl}
                      alt="Annotated detection result"
                      scanning={phase === "running"}
                    />
                  </div>
                ) : showDone && result.kind === "compare" ? (
                  <div className="flex flex-col gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <CompareImageCard
                        heading="E2 DETECTION RESULT"
                        subtitle="Experiment 2 (e2best.pt)"
                        side={result.data.e2}
                        badgeClass="bg-[#14746f] text-white"
                        onDownload={() => {
                          if (result.data.e2.annotated_image) {
                            downloadUrl(
                              `data:${result.data.e2.annotated_mime || "image/jpeg"};base64,${result.data.e2.annotated_image}`,
                              "faw-e2-annotated.jpg",
                            );
                          }
                        }}
                      />
                      <CompareImageCard
                        heading="E3 DETECTION RESULT"
                        subtitle="Experiment 3 (best.pt · Production)"
                        side={result.data.e3}
                        badgeClass="bg-primary text-primary-foreground"
                        onDownload={() => {
                          if (result.data.e3.annotated_image) {
                            downloadUrl(
                              `data:${result.data.e3.annotated_mime || "image/jpeg"};base64,${result.data.e3.annotated_image}`,
                              "faw-e3-annotated.jpg",
                            );
                          }
                        }}
                      />
                    </div>
                    <ComparisonMetricsSection data={result.data} />
                  </div>
                ) : previewUrl && file ? (
                  <ImageFrame
                    title={`Original image · ${file.name} (${formatBytes(file.size)})`}
                    src={previewUrl}
                    alt="Uploaded corn leaf preview"
                    scanning={phase === "running"}
                  />
                ) : (
                  <Dropzone
                    inputId={inputId}
                    dragging={dragging}
                    maxBytes={maxBytes}
                    onBrowse={() => inputRef.current?.click()}
                    onDragState={setDragging}
                    onFile={(next) => void acceptFile(next)}
                  />
                )}
              </section>

              {/* Controls & Results Sidebar — always visible above the fold */}
              <aside className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-4">
                <ModelSelector value={modelMode} disabled={phase === "running"} onChange={setModelMode} />

                <ConfidenceSlider
                  value={confidenceThreshold}
                  disabled={phase === "running"}
                  onChange={setConfidenceThreshold}
                  compact
                />

                {file && previewUrl ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => void onDetect()}
                        disabled={phase === "running"}
                      >
                        {phase === "running" ? (
                          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                        ) : (
                          <ScanSearch className="size-4" aria-hidden="true" />
                        )}
                        {phase === "running"
                          ? "Detecting..."
                          : showDone
                            ? "Re-detect"
                            : modelMode === "compare"
                              ? "Run Comparison"
                              : "Detect"}
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50"
                        onClick={resetAll}
                        disabled={phase === "running"}
                      >
                        <RotateCcw className="size-4" aria-hidden="true" />
                        Reset
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    onClick={() => inputRef.current?.click()}
                  >
                    <Upload className="size-4" aria-hidden="true" />
                    Browse image
                  </button>
                )}

                {showDone && result.kind === "single" ? (
                  <SingleResultsSummary
                    result={result}
                    onDownload={() => downloadUrl(result.annotatedUrl, `faw-${result.modelMode}-annotated.jpg`)}
                  />
                ) : showDone && result.kind === "compare" ? (
                  <div className="rounded-2xl bg-canvas p-3.5 text-xs text-muted">
                    <p className="font-semibold text-ink">Comparison Complete</p>
                    <p className="mt-1">
                      E2: <strong className="text-ink">{result.data.e2.total_detections}</strong> boxes (
                      {result.data.e2.inference_ms} ms) · E3:{" "}
                      <strong className="text-ink">{result.data.e3.total_detections}</strong> boxes (
                      {result.data.e3.inference_ms} ms)
                    </p>
                    <p className="mt-1.5 text-[11px]">{result.data.validation_message}</p>
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed text-muted">
                    One class only: <strong className="text-ink">infected</strong> (suspected leaf damage). No boxes
                    does not guarantee the leaf is healthy.
                  </p>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export function ModelSelector({
  value,
  disabled,
  onChange,
}: {
  value: ModelMode;
  disabled?: boolean;
  onChange: (next: ModelMode) => void;
}) {
  return (
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
            disabled={disabled}
            onClick={() => onChange(opt.id)}
            className={
              value === opt.id
                ? "rounded-xl border-2 border-primary bg-surface px-2 py-2 text-xs font-semibold text-primary shadow-xs"
                : "rounded-xl border border-line bg-surface/60 px-2 py-2 text-xs font-medium text-ink hover:border-primary/40"
            }
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ServiceStatus | null }) {
  const ready = status?.model_ready === true;
  const label = !status ? "Checking model" : ready ? "Weights loaded" : "Weights not loaded";
  return (
    <p
      className={
        ready
          ? "inline-flex h-9 items-center rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground"
          : "inline-flex h-9 items-center rounded-full border border-line bg-canvas px-3.5 text-xs font-semibold text-ink"
      }
    >
      {label}
    </p>
  );
}

function Dropzone({
  inputId,
  dragging,
  maxBytes,
  onBrowse,
  onDragState,
  onFile,
}: {
  inputId: string;
  dragging: boolean;
  maxBytes: number;
  onBrowse: () => void;
  onDragState: (value: boolean) => void;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <div
      className={
        dragging
          ? "flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-primary/5 px-6 py-10 text-center"
          : "flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-line bg-surface px-6 py-10 text-center"
      }
      onDragEnter={(event) => {
        event.preventDefault();
        onDragState(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        onDragState(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        onDragState(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDragState(false);
        onFile(event.dataTransfer.files?.[0]);
      }}
    >
      <span className="flex size-14 items-center justify-center rounded-2xl bg-canvas text-primary">
        <Upload className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="font-display text-2xl text-ink">Upload a corn leaf</p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Drag a photo here, or browse. JPG and PNG, up to {Math.max(1, Math.round(maxBytes / (1024 * 1024)))} MB.
        </p>
      </div>
      <button
        type="button"
        className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        onClick={onBrowse}
        aria-controls={inputId}
      >
        Browse image
      </button>
    </div>
  );
}

function ImageFrame({
  title,
  src,
  alt,
  scanning = false,
}: {
  title: string;
  src: string;
  alt: string;
  scanning?: boolean;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <figcaption className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">{title}</figcaption>
      <div className="relative flex items-center justify-center bg-canvas">
        <img src={src} alt={alt} className="max-h-[54vh] w-full object-contain" />
        {scanning ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden bg-ink/10">
            <div className="scanline absolute inset-x-0 h-1/3 bg-linear-to-b from-transparent via-primary/40 to-transparent" />
          </div>
        ) : null}
      </div>
    </figure>
  );
}

function ConfidenceSlider({
  value,
  disabled,
  onChange,
  compact = false,
}: {
  value: number;
  disabled?: boolean;
  onChange: (next: number) => void;
  compact?: boolean;
}) {
  const sliderId = useId();
  return (
    <div className={compact ? "rounded-2xl bg-canvas p-3" : "rounded-2xl border border-line bg-surface p-4 shadow-sm"}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={sliderId} className="text-xs font-semibold text-ink">
          Confidence Threshold
        </label>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
          {formatThreshold(value)}
        </span>
      </div>
      <input
        id={sliderId}
        type="range"
        min={MIN_CONFIDENCE_THRESHOLD}
        max={MAX_CONFIDENCE_THRESHOLD}
        step={CONFIDENCE_THRESHOLD_STEP}
        value={value}
        disabled={disabled}
        aria-valuetext={formatThreshold(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-muted tabular-nums">
        <span>0.05</span>
        <span>Default 0.20</span>
        <span>0.90</span>
      </div>
    </div>
  );
}

function SingleResultsSummary({
  result,
  onDownload,
}: {
  result: SingleResultView;
  onDownload: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-muted uppercase">Total detections</p>
          <p className="font-display text-4xl leading-none text-ink tabular-nums">{result.total}</p>
        </div>
        <div className="rounded-xl bg-canvas px-2.5 py-1.5 text-right text-xs">
          <p className="text-muted">{result.modelMode.toUpperCase()}</p>
          <p className="font-semibold text-ink tabular-nums">{formatThreshold(result.thresholdUsed)}</p>
        </div>
      </div>

      {result.total === 0 ? (
        <p className="rounded-xl bg-canvas px-3 py-2.5 text-xs text-muted">
          No suspected FAW damage detected at this threshold.
        </p>
      ) : (
        <ol className="flex max-h-48 flex-col gap-1.5 overflow-auto">
          {result.detections.map((detection, index) => (
            <li
              key={`${detection.bbox.join("-")}-${index}`}
              className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-xs"
            >
              <span className="font-semibold text-ink">
                {index + 1}. {detection.class}
              </span>
              <span className="font-semibold text-primary tabular-nums">{formatConfidence(detection.confidence)}</span>
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-canvas px-4 text-xs font-semibold text-ink hover:border-primary"
        onClick={onDownload}
      >
        <Download className="size-3.5" aria-hidden="true" />
        Download annotated image
      </button>
    </div>
  );
}

function CompareImageCard({
  heading,
  subtitle,
  side,
  badgeClass,
  onDownload,
}: {
  heading: string;
  subtitle: string;
  side: ModelSideResult;
  badgeClass: string;
  onDownload: () => void;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">{heading}</p>
          <p className="text-sm font-semibold text-ink">{subtitle}</p>
        </div>
        {side.available ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${badgeClass}`}>
            {side.total_detections} boxes · {side.inference_ms} ms
          </span>
        ) : (
          <span className="rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-ink">Unavailable</span>
        )}
      </div>
      {side.available && side.annotated_image ? (
        <>
          <img
            src={`data:${side.annotated_mime || "image/jpeg"};base64,${side.annotated_image}`}
            alt={heading}
            className="max-h-[45vh] w-full rounded-xl bg-canvas object-contain"
          />
          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-canvas px-4 text-xs font-semibold text-ink hover:border-primary"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Download {heading.split(" ")[0]} Result
          </button>
        </>
      ) : (
        <p className="rounded-xl bg-canvas p-3 text-xs text-muted">{side.error || "Model unavailable."}</p>
      )}
    </section>
  );
}

function ComparisonMetricsSection({ data }: { data: Extract<CompareResponse, { success: true }> }) {
  const speedData = [
    { model: "E2", ms: data.e2.available ? data.e2.inference_ms : 0 },
    { model: "E3", ms: data.e3.available ? data.e3.inference_ms : 0 },
  ];
  const countData = [
    { model: "E2", detections: data.e2.available ? data.e2.total_detections : 0 },
    { model: "E3", detections: data.e3.available ? data.e3.total_detections : 0 },
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h3 className="font-display text-xl text-ink">Inference Comparison Table</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line text-muted uppercase">
              <th className="py-2 pr-3">Parameter</th>
              <th className="py-2 pr-3">E2 (e2best.pt)</th>
              <th className="py-2 pr-3">E3 (best.pt)</th>
              <th className="py-2">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            <tr>
              <td className="py-2 pr-3 font-medium text-ink">Total detections</td>
              <td className="py-2 pr-3 tabular-nums">{data.e2.total_detections}</td>
              <td className="py-2 pr-3 tabular-nums">{data.e3.total_detections}</td>
              <td className="py-2 text-muted">Requires ground truth for accuracy</td>
            </tr>
            <tr>
              <td className="py-2 pr-3 font-medium text-ink">Avg confidence</td>
              <td className="py-2 pr-3 tabular-nums">
                {data.e2.total_detections > 0 ? formatConfidence(data.e2.average_confidence || 0) : "—"}
              </td>
              <td className="py-2 pr-3 tabular-nums">
                {data.e3.total_detections > 0 ? formatConfidence(data.e3.average_confidence || 0) : "—"}
              </td>
              <td className="py-2 text-muted">Calibration-dependent</td>
            </tr>
            <tr>
              <td className="py-2 pr-3 font-medium text-ink">Inference time</td>
              <td className="py-2 pr-3 tabular-nums">{data.e2.inference_ms} ms</td>
              <td className="py-2 pr-3 tabular-nums">{data.e3.inference_ms} ms</td>
              <td className="py-2 font-medium text-primary">
                {data.e2.inference_ms < data.e3.inference_ms ? "E2 faster" : "E3 faster"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-44 w-full">
          <p className="mb-1 text-xs font-semibold text-ink">Inference Speed (ms)</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={speedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3dccb" />
              <XAxis dataKey="model" tick={{ fontSize: 11, fill: "#17261e" }} />
              <YAxis tick={{ fontSize: 11, fill: "#5d6b63" }} />
              <Tooltip />
              <Bar dataKey="ms" fill="#245c3a" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-44 w-full">
          <p className="mb-1 text-xs font-semibold text-ink">Detection Count</p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={countData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3dccb" />
              <XAxis dataKey="model" tick={{ fontSize: 11, fill: "#17261e" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5d6b63" }} />
              <Tooltip />
              <Bar dataKey="detections" fill="#c4841d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
