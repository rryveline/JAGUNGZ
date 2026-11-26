import { useEffect, useId, useRef, useState } from "react";
import { Download, GitCompare, Loader2, RotateCcw, TriangleAlert, Upload } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  type ModelMetadata,
  type ModelSideResult,
  type ModelsStatusResponse,
} from "@/lib/detection";

type CompareSuccess = Extract<CompareResponse, { success: true }>;

export function ModelComparisonPanel() {
  const inputId = useId();
  const sliderId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);

  const [modelsStatus, setModelsStatus] = useState<ModelsStatusResponse | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(DEFAULT_CONFIDENCE_THRESHOLD);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareSuccess | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/models/status");
        const data = (await res.json()) as ModelsStatusResponse;
        if (!cancelled && data && typeof data === "object" && "e2" in data && "e3" in data) {
          setModelsStatus(data);
        }
      } catch {
        // Ignore; error shown if comparison is attempted while offline.
      }
    }
    void load();
    return () => {
      cancelled = true;
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
    if (inputRef.current) inputRef.current.value = "";
  }

  async function acceptFile(next: File | undefined) {
    if (!next) {
      setError("No file is selected.");
      return;
    }
    const problem = await validateLeafImage(next, DEFAULT_MAX_UPLOAD_BYTES);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setResult(null);
    replacePreview(URL.createObjectURL(next));
    setFile(next);
  }

  async function runComparison() {
    if (!file || running) return;
    setRunning(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("confidence_threshold", confidenceThreshold.toFixed(2));
      const response = await fetch("/api/detect/compare", { method: "POST", body });
      const payload = (await response.json()) as CompareResponse;
      if (!payload.success) {
        setError(payload.message || "Unable to compare models on the uploaded image.");
        return;
      }
      setResult(payload);
    } catch {
      setError("The detection service could not be reached.");
    } finally {
      setRunning(false);
    }
  }

  function downloadAnnotated(side: ModelSideResult, filename: string) {
    if (!side.annotated_image) return;
    const mime = side.annotated_mime || "image/jpeg";
    const link = document.createElement("a");
    link.href = `data:${mime};base64,${side.annotated_image}`;
    link.download = filename;
    link.click();
  }

  const e2Meta = result?.e2_meta ?? modelsStatus?.e2 ?? null;
  const e3Meta = result?.e3_meta ?? modelsStatus?.e3 ?? null;
  const speedChartData = result
    ? [
        { model: "E2 (e2best.pt)", ms: result.e2.available ? result.e2.inference_ms : 0 },
        { model: "E3 (best.pt)", ms: result.e3.available ? result.e3.inference_ms : 0 },
      ]
    : [];
  const countChartData = result
    ? [
        { model: "E2 (e2best.pt)", detections: result.e2.available ? result.e2.total_detections : 0 },
        { model: "E3 (best.pt)", detections: result.e3.available ? result.e3.total_detections : 0 },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <p className="text-xs font-semibold tracking-widest text-accent uppercase">AI Model Comparison</p>
        <h2 className="mt-1 font-display text-3xl text-ink">Model Performance Comparison</h2>
        <p className="mt-1 text-sm text-muted">
          Compare Experiment 2 and Experiment 3 detection performance.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <ModelInfoCard title="MODEL E2" meta={e2Meta} fallbackFile="e2best.pt" fallbackExperiment="Experiment 2" />
          <ModelInfoCard title="MODEL E3" meta={e3Meta} fallbackFile="best.pt" fallbackExperiment="Experiment 3" isProduction />
        </div>

        {modelsStatus?.compatibility_warning ? (
          <div
            role="alert"
            className="mt-4 flex items-start gap-3 rounded-2xl border border-accent bg-canvas px-4 py-3 text-sm text-ink"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
            <p>{modelsStatus.compatibility_warning}</p>
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl bg-canvas px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-ink">Quantitative Dataset Evaluation: </span>
          {modelsStatus?.validation_message ||
            "Quantitative evaluation unavailable – validation dataset or ground-truth labels not found."}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-accent bg-surface px-4 py-3 text-sm text-ink"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="font-display text-2xl text-ink">Single-Image Side-by-Side Comparison</h3>
            <p className="mt-1 text-sm text-muted">
              Both models run on the exact same image, resolution, confidence threshold, and IoU threshold.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-canvas px-4 text-sm font-semibold text-ink hover:border-primary"
            >
              <Upload className="size-4" aria-hidden="true" />
              {file ? "Change image" : "Upload leaf image"}
            </button>
            {file ? (
              <>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void runComparison()}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {running ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <GitCompare className="size-4" aria-hidden="true" />}
                  {running ? "Comparing..." : "Run Comparison"}
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={resetAll}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink hover:bg-canvas disabled:opacity-50"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  Reset
                </button>
              </>
            ) : null}
          </div>
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          className="sr-only"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          onChange={(event) => {
            const next = event.target.files?.[0];
            event.target.value = "";
            void acceptFile(next);
          }}
        />

        <div className="mt-4 rounded-2xl bg-canvas p-4">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={sliderId} className="text-sm font-semibold text-ink">
              Shared Confidence Threshold
            </label>
            <span className="shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-semibold text-primary tabular-nums">
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
            disabled={running}
            onChange={(event) => setConfidenceThreshold(Number(event.target.value))}
            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary disabled:opacity-50"
          />
          <div className="mt-1.5 flex items-center justify-between text-xs text-muted tabular-nums">
            <span>0.05</span>
            <span>Default 0.20</span>
            <span>0.90</span>
          </div>
        </div>

        {previewUrl && file && !result ? (
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-canvas">
            <p className="border-b border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink">
              Original Reference Image · {file.name} ({formatBytes(file.size)})
            </p>
            <img src={previewUrl} alt="Original corn leaf reference" className="max-h-[50vh] w-full object-contain" />
          </div>
        ) : null}
      </div>

      {result ? (
        <>
          {previewUrl ? (
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
              <p className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
                Original Reference Image ({result.image_width}×{result.image_height} · Threshold{" "}
                {formatThreshold(result.confidence_threshold)} · IoU {result.iou_threshold.toFixed(2)} · imgsz{" "}
                {result.imgsz})
              </p>
              <img src={previewUrl} alt="Original corn leaf" className="max-h-[38vh] w-full bg-canvas object-contain" />
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <ModelResultColumn
              heading="E2 DETECTION RESULT"
              subtitle="Experiment 2 (e2best.pt)"
              side={result.e2}
              badgeColor="bg-[#14746f] text-white"
              downloadLabel="Download E2 Result"
              onDownload={() => downloadAnnotated(result.e2, "faw-e2-annotated.jpg")}
            />
            <ModelResultColumn
              heading="E3 DETECTION RESULT"
              subtitle="Experiment 3 (best.pt · Production)"
              side={result.e3}
              badgeColor="bg-primary text-primary-foreground"
              downloadLabel="Download E3 Result"
              onDownload={() => downloadAnnotated(result.e3, "faw-e3-annotated.jpg")}
            />
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h3 className="font-display text-2xl text-ink">Inference Comparison Table</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold tracking-wider text-muted uppercase">
                    <th className="py-2.5 pr-4">Parameter</th>
                    <th className="py-2.5 pr-4">E2 (e2best.pt)</th>
                    <th className="py-2.5 pr-4">E3 (best.pt)</th>
                    <th className="py-2.5">Note / Better Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  <tr>
                    <td className="py-3 pr-4 font-medium text-ink">Total detections</td>
                    <td className="py-3 pr-4 tabular-nums">{result.e2.available ? result.e2.total_detections : "Error"}</td>
                    <td className="py-3 pr-4 tabular-nums">{result.e3.available ? result.e3.total_detections : "Error"}</td>
                    <td className="py-3 text-muted">Cannot determine accuracy without ground truth</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-ink">Detection confidence (Max / Min)</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {result.e2.available && result.e2.total_detections > 0
                        ? `${formatConfidence(result.e2.max_confidence || 0)} / ${formatConfidence(result.e2.min_confidence || 0)}`
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {result.e3.available && result.e3.total_detections > 0
                        ? `${formatConfidence(result.e3.max_confidence || 0)} / ${formatConfidence(result.e3.min_confidence || 0)}`
                        : "—"}
                    </td>
                    <td className="py-3 text-muted">Higher confidence is not proof of higher accuracy</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-ink">Average confidence</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {result.e2.available && result.e2.total_detections > 0
                        ? formatConfidence(result.e2.average_confidence || 0)
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {result.e3.available && result.e3.total_detections > 0
                        ? formatConfidence(result.e3.average_confidence || 0)
                        : "—"}
                    </td>
                    <td className="py-3 text-muted">Depends on calibration &amp; threshold</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-ink">Inference time</td>
                    <td className="py-3 pr-4 tabular-nums">{result.e2.available ? `${result.e2.inference_ms} ms` : "—"}</td>
                    <td className="py-3 pr-4 tabular-nums">{result.e3.available ? `${result.e3.inference_ms} ms` : "—"}</td>
                    <td className="py-3 font-medium text-primary">
                      {result.e2.available && result.e3.available
                        ? result.e2.inference_ms === result.e3.inference_ms
                          ? "Tie"
                          : result.e2.inference_ms < result.e3.inference_ms
                            ? "E2 faster"
                            : "E3 faster"
                        : "—"}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-ink">Number of detected classes</td>
                    <td className="py-3 pr-4 tabular-nums">{result.e2.available ? result.e2.num_detected_classes ?? 0 : "—"}</td>
                    <td className="py-3 pr-4 tabular-nums">{result.e3.available ? result.e3.num_detected_classes ?? 0 : "—"}</td>
                    <td className="py-3 text-muted">Single-class model (infected)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Note: Single-image inference only illustrates prediction differences between E2 and E3, not overall model
              accuracy. Quantitative metrics (Precision, Recall, F1, mAP) require a labeled validation dataset.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <h4 className="font-display text-xl text-ink">Inference Speed Comparison (ms)</h4>
              <p className="mt-1 text-xs text-muted">Lower is faster</p>
              <div className="mt-4 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={speedChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3dccb" />
                    <XAxis dataKey="model" tick={{ fontSize: 12, fill: "#17261e" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#5d6b63" }} />
                    <Tooltip />
                    <Bar dataKey="ms" name="Inference (ms)" fill="#245c3a" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <h4 className="font-display text-xl text-ink">Detection Count Comparison</h4>
              <p className="mt-1 text-xs text-muted">Objects detected on this image</p>
              <div className="mt-4 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={countChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e3dccb" />
                    <XAxis dataKey="model" tick={{ fontSize: 12, fill: "#17261e" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#5d6b63" }} />
                    <Tooltip />
                    <Bar dataKey="detections" name="Detections" fill="#c4841d" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function ModelInfoCard({
  title,
  meta,
  fallbackFile,
  fallbackExperiment,
  isProduction = false,
}: {
  title: string;
  meta: ModelMetadata | null;
  fallbackFile: string;
  fallbackExperiment: string;
  isProduction?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-canvas p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold tracking-wider text-muted uppercase">{title}</p>
          <p className="font-display text-xl text-ink">{meta?.experiment || fallbackExperiment}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {isProduction ? (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              Current Production
            </span>
          ) : (
            <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink">
              Comparison
            </span>
          )}
          <span
            className={
              meta?.model_ready
                ? "rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
                : "rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-ink"
            }
          >
            {meta ? (meta.model_ready ? "Loaded" : "Unavailable") : "Checking..."}
          </span>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted">File</dt>
          <dd className="font-semibold text-ink">{meta?.file || fallbackFile}</dd>
        </div>
        <div>
          <dt className="text-muted">Architecture</dt>
          <dd className="font-semibold text-ink">{meta?.architecture || "YOLO26"}</dd>
        </div>
        <div>
          <dt className="text-muted">Classes</dt>
          <dd className="font-semibold text-ink">
            {meta ? `${meta.num_classes} (${meta.class_names.join(", ") || "none"})` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Input Resolution</dt>
          <dd className="font-semibold text-ink tabular-nums">
            {meta ? `${meta.inference_imgsz}px (train ${meta.train_imgsz}px)` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Default Conf / IoU</dt>
          <dd className="font-semibold text-ink tabular-nums">
            {meta ? `${meta.confidence_threshold.toFixed(2)} / ${meta.iou_threshold.toFixed(2)}` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Status</dt>
          <dd className="truncate font-semibold text-ink" title={meta?.message}>
            {meta?.model_ready ? "Ready" : meta?.message || "Checking"}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function ModelResultColumn({
  heading,
  subtitle,
  side,
  badgeColor,
  downloadLabel,
  onDownload,
}: {
  heading: string;
  subtitle: string;
  side: ModelSideResult;
  badgeColor: string;
  downloadLabel: string;
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
          <span className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${badgeColor}`}>
            {side.total_detections} boxes · {side.inference_ms} ms
          </span>
        ) : (
          <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-ink">Unavailable</span>
        )}
      </div>

      {!side.available ? (
        <div className="rounded-2xl bg-canvas p-4 text-sm text-ink">
          {side.error || "Model could not be loaded for comparison."}
        </div>
      ) : (
        <>
          {side.annotated_image ? (
            <img
              src={`data:${side.annotated_mime || "image/jpeg"};base64,${side.annotated_image}`}
              alt={heading}
              className="max-h-[45vh] w-full rounded-xl bg-canvas object-contain"
            />
          ) : null}

          <div className="grid grid-cols-3 gap-2 rounded-xl bg-canvas p-3 text-center text-xs">
            <div>
              <p className="text-muted">Objects</p>
              <p className="mt-0.5 text-base font-semibold text-ink tabular-nums">{side.total_detections}</p>
            </div>
            <div>
              <p className="text-muted">Avg Conf</p>
              <p className="mt-0.5 text-base font-semibold text-ink tabular-nums">
                {side.total_detections > 0 ? formatConfidence(side.average_confidence || 0) : "—"}
              </p>
            </div>
            <div>
              <p className="text-muted">Time</p>
              <p className="mt-0.5 text-base font-semibold text-ink tabular-nums">{side.inference_ms} ms</p>
            </div>
          </div>

          {side.detections.length > 0 ? (
            <ol className="flex max-h-44 flex-col gap-1.5 overflow-auto">
              {side.detections.map((det, idx) => (
                <li
                  key={`${det.bbox.join("-")}-${idx}`}
                  className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-ink">
                    {idx + 1}. {det.class}
                  </span>
                  <span className="font-semibold text-primary tabular-nums">{formatConfidence(det.confidence)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-xl bg-canvas px-3 py-2.5 text-xs text-muted">No objects detected at this threshold.</p>
          )}

          <button
            type="button"
            onClick={onDownload}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-canvas px-4 text-sm font-semibold text-ink hover:border-primary"
          >
            <Download className="size-4" aria-hidden="true" />
            {downloadLabel}
          </button>
        </>
      )}
    </section>
  );
}
