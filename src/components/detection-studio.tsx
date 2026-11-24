import { useEffect, useId, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Leaf, Loader2, RotateCcw, ScanSearch, TriangleAlert, Upload } from "lucide-react";
import {
  DEFAULT_MAX_UPLOAD_BYTES,
  formatBytes,
  formatConfidence,
  validateLeafImage,
  type DetectResponse,
  type ServiceStatus,
} from "@/lib/detection";

type Phase = "empty" | "ready" | "running" | "done";

type ResultView = {
  total: number;
  detections: DetectSuccessDetections;
  annotatedUrl: string;
};

type DetectSuccessDetections = Extract<DetectResponse, { success: true }>["detections"];

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
  const [phase, setPhase] = useState<Phase>("empty");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultView | null>(null);

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
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/detect", { method: "POST", body });
      const payload = (await response.json()) as DetectResponse;
      if (!payload.success) {
        setError(payload.message || "Unable to process the uploaded image.");
        setPhase("ready");
        return;
      }
      const mime = payload.annotated_mime || "image/jpeg";
      setResult({
        total: payload.total_detections,
        detections: payload.detections,
        annotatedUrl: `data:${mime};base64,${payload.annotated_image}`,
      });
      setPhase("done");
    } catch {
      setError("The detection service could not be reached. Nothing was inferred locally in the browser.");
      setPhase("ready");
    }
  }

  function downloadAnnotated() {
    if (!result) return;
    const link = document.createElement("a");
    link.href = result.annotatedUrl;
    link.download = "faw-annotated.jpg";
    link.click();
  }

  const showCompare = phase === "done" && result && previewUrl;
  const live =
    phase === "running"
      ? "Running detection."
      : error
        ? error
        : phase === "done" && result
          ? result.total === 0
            ? "No suspected FAW damage detected."
            : `${result.total} detections.`
          : "";

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <Link
            to="/"
            className="group inline-flex h-10 items-center gap-2 rounded-full border border-line bg-canvas px-4 text-sm font-semibold text-ink transition-colors duration-200 hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="size-4 transition-transform duration-300 ease-out group-hover:-translate-x-1" aria-hidden="true" />
            Back to home
          </Link>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Leaf className="size-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-accent">Data Mining and Warehousing - B</p>
              <h1 className="font-display text-4xl leading-none font-semibold text-balance text-ink sm:text-5xl">
                <Link to="/">JAGUNGZ</Link>
              </h1>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-pretty text-muted">
                Detect suspected Fall Armyworm damage on corn leaves using computer vision.
              </p>
            </div>
          </div>
          <StatusPill status={status} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <p className="sr-only" aria-live="polite">
          {live}
        </p>
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-accent bg-surface px-4 py-3 text-sm text-ink"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            <p>{error}</p>
          </div>
        ) : null}

        <div className={showCompare ? "grid items-start gap-4 lg:grid-cols-[1fr_1fr_19rem]" : "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]"}>
          {showCompare ? (
            <>
              <ImageFrame title="Original image" src={previewUrl} alt="Uploaded corn leaf" />
              <ImageFrame title="Detection result" src={result.annotatedUrl} alt="Annotated detection result" />
            </>
          ) : (
            <section className="flex flex-col gap-4">
              {previewUrl && file ? (
                <ImageFrame title="Original image" src={previewUrl} alt="Uploaded corn leaf preview" scanning={phase === "running"} />
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
              {file && previewUrl ? (
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => void onDetect()}
                    disabled={phase === "running"}
                  >
                    {phase === "running" ? (
                      <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                    ) : (
                      <ScanSearch className="size-4" aria-hidden="true" />
                    )}
                    {phase === "running" ? "Running detection" : "Detect"}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-canvas disabled:opacity-50"
                    onClick={resetAll}
                    disabled={phase === "running"}
                  >
                    <RotateCcw className="size-4" aria-hidden="true" />
                    Reset
                  </button>
                </div>
              ) : null}
            </section>
          )}

          <aside className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm">
            {showCompare && result ? (
              <ResultsPanel result={result} onDownload={downloadAnnotated} onReset={resetAll} />
            ) : (
              <SpecPanel file={file} status={status} running={phase === "running"} />
            )}
            <p className="text-sm leading-relaxed text-pretty text-muted">
              One class only: infected, meaning suspected fall armyworm damage on a corn leaf. No boxes does not mean the leaf is healthy.
            </p>
          </aside>
        </div>
      </main>
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
          ? "inline-flex h-10 items-center self-start rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground lg:self-auto"
          : "inline-flex h-10 items-center self-start rounded-full border border-line bg-canvas px-4 text-sm font-semibold text-ink lg:self-auto"
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
          ? "flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-primary/5 px-6 py-10 text-center"
          : "flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-line bg-surface px-6 py-10 text-center"
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
        className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
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
      <figcaption className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">{title}</figcaption>
      <div className="relative flex items-center justify-center bg-canvas">
        <img src={src} alt={alt} className="max-h-[70vh] w-full object-contain" />
        {scanning ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden bg-ink/10">
            <div className="scanline absolute inset-x-0 h-1/3 bg-linear-to-b from-transparent via-primary/40 to-transparent" />
          </div>
        ) : null}
      </div>
    </figure>
  );
}

function SpecPanel({
  file,
  status,
  running,
}: {
  file: File | null;
  status: ServiceStatus | null;
  running: boolean;
}) {
  const threshold =
    status?.confidence_threshold == null ? "Not reported" : status.confidence_threshold.toFixed(2);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">{running ? "In progress" : "Readout"}</p>
        <h2 className="mt-1 truncate font-display text-3xl text-ink" title={file?.name || undefined}>
          {file ? file.name : "Waiting for a leaf"}
        </h2>
        {file ? <p className="mt-1 text-sm text-muted">{formatBytes(file.size)} · confirm the preview, then detect</p> : null}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-canvas px-3 py-3">
          <dt className="text-muted">Class</dt>
          <dd className="mt-1 font-semibold text-ink">{status?.class_name || "infected"}</dd>
        </div>
        <div className="rounded-2xl bg-canvas px-3 py-3">
          <dt className="text-muted">Threshold</dt>
          <dd className="mt-1 font-semibold text-ink tabular-nums">{threshold}</dd>
        </div>
      </dl>
      <p className="text-sm leading-relaxed text-pretty text-muted">
        {status?.message || "Checking whether the trained weights are available."} The threshold is a placeholder until validation selects the final cutoff.
      </p>
    </div>
  );
}

function ResultsPanel({
  result,
  onDownload,
  onReset,
}: {
  result: ResultView;
  onDownload: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">Total detections</p>
        <p className="font-display text-6xl leading-none text-ink tabular-nums">{result.total}</p>
      </div>
      {result.total === 0 ? (
        <div className="rounded-2xl bg-canvas px-4 py-3">
          <p className="font-semibold text-ink">No suspected FAW damage detected.</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            The annotated image has no boxes. That is not a health verdict.
          </p>
        </div>
      ) : (
        <ol className="flex max-h-80 flex-col gap-2 overflow-auto">
          {result.detections.map((detection, index) => (
            <li key={`${detection.bbox.join("-")}-${index}`} className="rounded-2xl bg-canvas px-3 py-3">
              <p className="text-sm font-semibold text-ink">Detection {index + 1}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted">Class</dt>
                  <dd className="font-medium text-ink">{detection.class}</dd>
                </div>
                <div>
                  <dt className="text-muted">Confidence</dt>
                  <dd className="font-medium text-ink tabular-nums">{formatConfidence(detection.confidence)}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        onClick={onDownload}
      >
        <Download className="size-4" aria-hidden="true" />
        Download annotated image
      </button>
      <button
        type="button"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-canvas"
        onClick={onReset}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
        Detect another image
      </button>
    </div>
  );
}
