export type Detection = {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
};

export type DetectSuccess = {
  success: true;
  confidence_threshold?: number;
  total_detections: number;
  detections: Detection[];
  annotated_image: string;
  annotated_mime?: string;
};

export type DetectFailure = {
  success: false;
  message: string;
};

export type DetectResponse = DetectSuccess | DetectFailure;

export type ServiceStatus = {
  service: "ok" | "unavailable";
  model_ready: boolean;
  class_name: string;
  confidence_threshold: number | null;
  iou_threshold?: number | null;
  imgsz?: number | null;
  max_upload_bytes: number;
  weights_hint: string;
  message: string;
};

export const MIN_CONFIDENCE_THRESHOLD = 0.05;
export const MAX_CONFIDENCE_THRESHOLD = 0.9;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.2;
export const CONFIDENCE_THRESHOLD_STEP = 0.05;
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function formatThreshold(value: number): string {
  const pct = Math.round(value * 100);
  return `${value.toFixed(2)} (${pct}%)`;
}

export function formatConfidence(value: number): string {
  const percent = value <= 1 ? value * 100 : value;
  return `${percent.toFixed(1)}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function sniff(file: File): Promise<"jpeg" | "png" | "other"> {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  return "other";
}

export async function validateLeafImage(file: File, maxBytes: number): Promise<string | null> {
  if (file.size === 0) return "The file is corrupted or cannot be read.";
  if (file.size > maxBytes) {
    const mb = Math.max(1, Math.round(maxBytes / (1024 * 1024)));
    return `The file exceeds the upload limit of ${mb} MB.`;
  }
  const kind = await sniff(file);
  if (kind === "other") return "Unsupported file. Upload a JPG, JPEG, or PNG image.";
  try {
    const bitmap = await createImageBitmap(file);
    const usable = bitmap.width >= 2 && bitmap.height >= 2;
    bitmap.close();
    if (!usable) return "The file is corrupted or cannot be read.";
  } catch {
    return "The file is corrupted or cannot be read.";
  }
  return null;
}
