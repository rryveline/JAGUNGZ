import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    const result = await runCli(["detect", path, "--conf", String(thresholdResult.value)], 120_000);
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
