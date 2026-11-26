import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

const OFFLINE_STATUS = {
  service: "unavailable" as const,
  model_ready: false,
  class_name: "infected",
  confidence_threshold: null,
  iou_threshold: null,
  max_upload_bytes: 10 * 1024 * 1024,
  weights_hint: "backend/models/best.pt",
  message:
    "The YOLO26 inference runtime is unavailable. Detections are reported only from your trained model — sample boxes are not substituted.",
};


type CliResult = { code: number; stdout: string };

function runCli(args: string[], timeoutMs: number): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const projectRoot = process.cwd();

    // Gunakan Python dari virtual environment JAGUNGZ
    const pythonBin =
      process.env.PYTHON_BIN ||
      join(projectRoot, ".venv", "bin", "python");

    const child = spawn(
      pythonBin,
      ["-m", "backend.cli", ...args],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          PYTHONPATH: projectRoot,
        },
      },
    );

    let stdout = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      const error = new Error("timeout");
      error.name = "TimeoutError";
      reject(error);
    }, timeoutMs);

    child.stdout.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? 1,
        stdout,
      });
    });
  });
}

function parsePayload(stdout: string): Record<string, unknown> | null {
  const line = stdout
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) return null;
  try {
    const payload = JSON.parse(line) as unknown;
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export async function proxyStatus(): Promise<Response> {
  try {
    const result = await runCli(["status"], 8000);
    const payload = parsePayload(result.stdout);
    if (!payload) return Response.json(OFFLINE_STATUS);
    return Response.json(payload);
  } catch {
    return Response.json(OFFLINE_STATUS);
  }
}

const MIN_CONFIDENCE_THRESHOLD = 0.05;
const MAX_CONFIDENCE_THRESHOLD = 0.9;
const DEFAULT_CONFIDENCE_THRESHOLD = 0.2;

function parseConfidenceThreshold(raw: FormDataEntryValue | null): { value: number } | { error: string } {
  if (raw === null) return { value: DEFAULT_CONFIDENCE_THRESHOLD };
  if (typeof raw !== "string") {
    return { error: "Confidence threshold must be a number between 0.05 and 0.90." };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { value: DEFAULT_CONFIDENCE_THRESHOLD };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < MIN_CONFIDENCE_THRESHOLD - 1e-9 || parsed > MAX_CONFIDENCE_THRESHOLD + 1e-9) {
    return { error: "Confidence threshold must be between 0.05 and 0.90." };
  }
  const clamped = Math.min(MAX_CONFIDENCE_THRESHOLD, Math.max(MIN_CONFIDENCE_THRESHOLD, parsed));
  return { value: Number(clamped.toFixed(4)) };
}

export async function proxyDetect(request: Request): Promise<Response> {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return Response.json({ success: false, message: "No file is selected." }, { status: 400 });
  }

  const thresholdResult = parseConfidenceThreshold(incoming.get("confidence_threshold"));
  if ("error" in thresholdResult) {
    return Response.json({ success: false, message: thresholdResult.error }, { status: 400 });
  }

  const rawModel = incoming.get("model_mode");
  const modelMode = rawModel === "e2" ? "e2" : "e3";

  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return Response.json({ success: false, message: "No file is selected." }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json(
      { success: false, message: "The file is corrupted or cannot be read." },
      { status: 400 },
    );
  }
  if (file.size > 32 * 1024 * 1024) {
    return Response.json(
      { success: false, message: "The file exceeds the upload limit." },
      { status: 413 },
    );
  }

  const extension = file.type === "image/png" || file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
  const path = join(tmpdir(), `faw-${randomUUID()}.${extension}`);

  try {
    await writeFile(path, Buffer.from(await file.arrayBuffer()));
    const result = await runCli(
      ["detect", path, "--conf", String(thresholdResult.value), "--model", modelMode],
      120_000,
    );
    const payload = parsePayload(result.stdout);
    if (!payload) {
      return Response.json(
        { success: false, message: "Unable to process the uploaded image." },
        { status: 502 },
      );
    }
    const status = typeof payload.status === "number" ? payload.status : payload.success ? 200 : 500;
    return Response.json(payload, { status });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      {
        success: false,
        message: timedOut
          ? "Detection took too long and was stopped. Try a smaller image."
          : OFFLINE_STATUS.message,
      },
      { status: timedOut ? 504 : 503 },
    );
  } finally {
    await unlink(path).catch(() => undefined);
  }
}

export async function proxyDetectFrame(request: Request): Promise<Response> {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return Response.json({ success: false, message: "No frame is selected." }, { status: 400 });
  }

  const thresholdResult = parseConfidenceThreshold(incoming.get("confidence_threshold"));
  if ("error" in thresholdResult) {
    return Response.json({ success: false, message: thresholdResult.error }, { status: 400 });
  }

  const rawModel = incoming.get("model_mode");
  const modelMode = rawModel === "e2" || rawModel === "compare" ? rawModel : "e3";

  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return Response.json({ success: false, message: "No frame is selected." }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ success: false, message: "The frame is empty or cannot be read." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ success: false, message: "The frame exceeds the upload limit." }, { status: 413 });
  }

  const extension = file.type === "image/png" || file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
  const path = join(tmpdir(), `faw-frame-${randomUUID()}.${extension}`);

  try {
    await writeFile(path, Buffer.from(await file.arrayBuffer()));
    const result = await runCli(
      ["detect-frame", path, "--conf", String(thresholdResult.value), "--model", modelMode],
      30_000,
    );
    const payload = parsePayload(result.stdout);
    if (!payload) {
      return Response.json({ success: false, message: "Unable to process the camera frame." }, { status: 502 });
    }
    const status = typeof payload.status === "number" ? payload.status : payload.success ? 200 : 500;
    return Response.json(payload, { status });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      {
        success: false,
        message: timedOut ? "Frame detection timed out." : OFFLINE_STATUS.message,
      },
      { status: timedOut ? 504 : 503 },
    );
  } finally {
    await unlink(path).catch(() => undefined);
  }
}

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_EXTS = new Set([".mp4", ".mov", ".avi", ".webm"]);
const JOB_TTL_MS = 15 * 60 * 1000;

type VideoJob = {
  jobId: string;
  status: "queued" | "processing" | "completed" | "failed";
  percent: number;
  processedFrames: number;
  totalFrames: number;
  detectionsSoFar: number;
  message: string;
  workDir: string;
  outputPath: string | null;
  outputMime: string;
  outputFilename: string;
  result: Record<string, unknown> | null;
};

const videoJobs = new Map<string, VideoJob>();

function scheduleJobCleanup(jobId: string, workDir: string) {
  setTimeout(() => {
    videoJobs.delete(jobId);
    void rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }, JOB_TTL_MS);
}

function parseSampleInterval(raw: FormDataEntryValue | null): { value: number } | { error: string } {
  if (raw === null) return { value: 0.5 };
  if (typeof raw !== "string") return { error: "Sample interval must be a number between 0.2 and 5.0 seconds." };
  const trimmed = raw.trim();
  if (!trimmed) return { value: 0.5 };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0.2 || parsed > 5.0) {
    return { error: "Sample interval must be between 0.2 and 5.0 seconds." };
  }
  return { value: Number(parsed.toFixed(2)) };
}

export async function proxyDetectVideoStart(request: Request): Promise<Response> {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return Response.json({ success: false, message: "No video file is selected." }, { status: 400 });
  }

  const thresholdResult = parseConfidenceThreshold(incoming.get("confidence_threshold"));
  if ("error" in thresholdResult) {
    return Response.json({ success: false, message: thresholdResult.error }, { status: 400 });
  }

  const intervalResult = parseSampleInterval(incoming.get("sample_interval_sec"));
  if ("error" in intervalResult) {
    return Response.json({ success: false, message: intervalResult.error }, { status: 400 });
  }

  const rawModel = incoming.get("model_mode");
  const modelMode = rawModel === "e2" || rawModel === "compare" ? rawModel : "e3";

  const file = incoming.get("file");
  if (!(file instanceof File) || !file.name) {
    return Response.json({ success: false, message: "No video file is selected." }, { status: 400 });
  }
  const ext = extname(file.name).toLowerCase();
  if (!ALLOWED_VIDEO_EXTS.has(ext)) {
    return Response.json(
      { success: false, message: "Unsupported video format. Upload an MP4, MOV, AVI, or WEBM file." },
      { status: 400 },
    );
  }
  if (file.size === 0) {
    return Response.json({ success: false, message: "The video file is corrupted or cannot be read." }, { status: 400 });
  }
  if (file.size > MAX_VIDEO_BYTES) {
    return Response.json(
      { success: false, message: "The video exceeds the upload limit of 50 MB." },
      { status: 413 },
    );
  }

  const jobId = randomUUID().replaceAll("-", "");
  const workDir = join(tmpdir(), `jagungz-vid-${jobId}`);
  const inputPath = join(workDir, `upload${ext}`);

  try {
    await mkdir(workDir, { recursive: true });
    await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
  } catch {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    return Response.json({ success: false, message: "Unable to store uploaded video for analysis." }, { status: 500 });
  }

  const job: VideoJob = {
    jobId,
    status: "queued",
    percent: 0,
    processedFrames: 0,
    totalFrames: 0,
    detectionsSoFar: 0,
    message: "Video queued for analysis.",
    workDir,
    outputPath: null,
    outputMime: "video/webm",
    outputFilename: "faw-annotated.webm",
    result: null,
  };
  videoJobs.set(jobId, job);
  scheduleJobCleanup(jobId, workDir);

  const projectRoot = process.cwd();
  const pythonBin = process.env.PYTHON_BIN || join(projectRoot, ".venv", "bin", "python");
  const child = spawn(
    pythonBin,
    [
      "-m",
      "backend.cli",
      "detect-video",
      inputPath,
      "--out-dir",
      workDir,
      "--conf",
      String(thresholdResult.value),
      "--interval",
      String(intervalResult.value),
      "--model",
      modelMode,
    ],
    {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: projectRoot },
    },
  );

  let buffer = "";
  const timer = setTimeout(() => {
    child.kill("SIGKILL");
    job.status = "failed";
    job.message = "Video analysis timed out. Try a shorter video or larger sample interval.";
  }, 300_000);

  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    buffer += chunk;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as Record<string, unknown>;
        if (msg.type === "progress") {
          job.status = "processing";
          job.percent = typeof msg.percent === "number" ? msg.percent : job.percent;
          job.processedFrames = typeof msg.processed_frames === "number" ? msg.processed_frames : job.processedFrames;
          job.totalFrames = typeof msg.total_frames === "number" ? msg.total_frames : job.totalFrames;
          job.detectionsSoFar = typeof msg.detections_so_far === "number" ? msg.detections_so_far : job.detectionsSoFar;
          job.message = `Analyzing sampled frame ${job.processedFrames} of ${job.totalFrames}...`;
        } else if (msg.type === "result") {
          if (msg.success) {
            const { type: _t, output_path: outPath, status: _s, ...summary } = msg;
            job.status = "completed";
            job.percent = 100;
            job.outputPath = typeof outPath === "string" ? outPath : null;
            job.outputMime = typeof summary.output_mime === "string" ? summary.output_mime : "video/webm";
            job.outputFilename = typeof summary.output_filename === "string" ? summary.output_filename : "faw-annotated.webm";
            job.result = summary;
            job.message = "Video analysis completed.";
          } else {
            job.status = "failed";
            job.message = typeof msg.message === "string" ? msg.message : "Unable to process the uploaded video.";
          }
        }
      } catch {
        // Ignore non-JSON log lines.
      }
    }
  });

  child.on("error", () => {
    clearTimeout(timer);
    job.status = "failed";
    job.message = OFFLINE_STATUS.message;
    void unlink(inputPath).catch(() => undefined);
  });

  child.on("close", () => {
    clearTimeout(timer);
    if (job.status === "queued" || job.status === "processing") {
      job.status = "failed";
      job.message = "Video analysis stopped unexpectedly.";
    }
    void unlink(inputPath).catch(() => undefined);
  });

  return Response.json({ success: true, job_id: jobId, status: "queued" }, { status: 202 });
}

export async function proxyVideoJobStatus(jobId: string, request: Request): Promise<Response> {
  const job = videoJobs.get(jobId);
  if (!job) {
    return Response.json({ success: false, message: "Video analysis job not found." }, { status: 404 });
  }

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/event-stream")) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let closed = false;
        const send = () => {
          if (closed) return;
          const current = videoJobs.get(jobId);
          if (!current) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ success: false, status: "failed", message: "Job expired." })}\n\n`),
            );
            closed = true;
            controller.close();
            return;
          }
          const payload = {
            success: current.status !== "failed",
            job_id: current.jobId,
            status: current.status,
            percent: current.percent,
            processed_frames: current.processedFrames,
            total_frames: current.totalFrames,
            detections_so_far: current.detectionsSoFar,
            message: current.message,
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          if (current.status === "completed" || current.status === "failed") {
            closed = true;
            controller.close();
          }
        };
        send();
        const interval = setInterval(() => {
          if (closed) {
            clearInterval(interval);
            return;
          }
          send();
        }, 400);
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  return Response.json({
    success: true,
    job_id: job.jobId,
    status: job.status,
    percent: job.percent,
    processed_frames: job.processedFrames,
    total_frames: job.totalFrames,
    detections_so_far: job.detectionsSoFar,
    message: job.message,
  });
}

export async function proxyVideoJobResult(jobId: string): Promise<Response> {
  const job = videoJobs.get(jobId);
  if (!job) {
    return Response.json({ success: false, message: "Video analysis job not found." }, { status: 404 });
  }
  if (job.status === "failed") {
    return Response.json({ success: false, message: job.message }, { status: 422 });
  }
  if (job.status !== "completed" || !job.result) {
    return Response.json({ success: false, message: "Video analysis is still in progress." }, { status: 409 });
  }
  return Response.json({
    success: true,
    job_id: job.jobId,
    video_url: `/api/detect/video/${job.jobId}/download`,
    ...job.result,
  });
}

export async function proxyModelsStatus(): Promise<Response> {
  try {
    const result = await runCli(["models-status"], 12_000);
    const payload = parsePayload(result.stdout);
    if (!payload) {
      return Response.json({ success: false, message: OFFLINE_STATUS.message }, { status: 503 });
    }
    return Response.json(payload);
  } catch {
    return Response.json({ success: false, message: OFFLINE_STATUS.message }, { status: 503 });
  }
}

export async function proxyCompare(request: Request): Promise<Response> {
  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return Response.json({ success: false, message: "No file is selected." }, { status: 400 });
  }

  const thresholdResult = parseConfidenceThreshold(incoming.get("confidence_threshold"));
  if ("error" in thresholdResult) {
    return Response.json({ success: false, message: thresholdResult.error }, { status: 400 });
  }

  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return Response.json({ success: false, message: "No file is selected." }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ success: false, message: "The file is corrupted or cannot be read." }, { status: 400 });
  }
  if (file.size > 32 * 1024 * 1024) {
    return Response.json({ success: false, message: "The file exceeds the upload limit." }, { status: 413 });
  }

  const extension = file.type === "image/png" || file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
  const path = join(tmpdir(), `faw-cmp-${randomUUID()}.${extension}`);

  try {
    await writeFile(path, Buffer.from(await file.arrayBuffer()));
    const result = await runCli(["compare", path, "--conf", String(thresholdResult.value)], 120_000);
    const payload = parsePayload(result.stdout);
    if (!payload) {
      return Response.json({ success: false, message: "Unable to compare models on the uploaded image." }, { status: 502 });
    }
    const status = typeof payload.status === "number" ? payload.status : payload.success ? 200 : 500;
    return Response.json(payload, { status });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return Response.json(
      {
        success: false,
        message: timedOut ? "Model comparison timed out. Try a smaller image." : OFFLINE_STATUS.message,
      },
      { status: timedOut ? 504 : 503 },
    );
  } finally {
    await unlink(path).catch(() => undefined);
  }
}

export async function proxyVideoDownload(jobId: string, request: Request): Promise<Response> {
  const job = videoJobs.get(jobId);
  if (!job || job.status !== "completed" || !job.outputPath) {
    return Response.json({ success: false, message: "Annotated video is not available." }, { status: 404 });
  }
  try {
    const data = await readFile(job.outputPath);
    const url = new URL(request.url);
    const inline = url.searchParams.get("inline") === "1";
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": job.outputMime,
        "Content-Disposition": inline
          ? `inline; filename="${job.outputFilename}"`
          : `attachment; filename="${job.outputFilename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ success: false, message: "Annotated video is no longer available." }, { status: 404 });
  }
}
