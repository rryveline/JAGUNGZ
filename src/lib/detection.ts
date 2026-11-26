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
  max_video_upload_bytes?: number;
  max_video_duration_sec?: number;
  video_sample_interval_sec?: number;
  weights_hint: string;
  message: string;
};

export type FrameDetectSuccess = {
  success: true;
  detection_method: "camera";
  model_mode?: "e2" | "e3" | "compare";
  confidence_threshold: number;
  frame_width: number;
  frame_height: number;
  inference_ms: number;
  total_detections: number;
  detections: Detection[];
  e2?: {
    available: boolean;
    total_detections: number;
    detections: Detection[];
    inference_ms: number;
  };
  e3?: {
    available: boolean;
    total_detections: number;
    detections: Detection[];
    inference_ms: number;
  };
};

export type ModelMetadata = {
  label: string;
  run_name: string;
  file: string;
  weights_hint: string;
  model_ready: boolean;
  architecture: string;
  num_classes: number;
  class_names: string[];
  class_map: Record<string, string>;
  train_imgsz: number;
  inference_imgsz: number;
  confidence_threshold: number;
  iou_threshold: number;
  message: string;
  experiment: string;
  status_badge: string;
  is_production: boolean;
};

export type ModelsStatusResponse = {
  success: boolean;
  e2: ModelMetadata;
  e3: ModelMetadata;
  class_compatible: boolean;
  compatibility_warning: string | null;
  validation_available: boolean;
  validation_message: string;
  message?: string;
};

export type ModelSideResult = {
  available: boolean;
  error: string | null;
  total_detections: number;
  detections: Detection[];
  detected_classes?: string[];
  num_detected_classes?: number;
  max_confidence?: number;
  min_confidence?: number;
  average_confidence?: number;
  inference_ms: number;
  annotated_image?: string;
  annotated_mime?: string;
};

export type CompareResponse =
  | {
      success: true;
      confidence_threshold: number;
      iou_threshold: number;
      imgsz: number;
      image_width: number;
      image_height: number;
      class_compatible: boolean;
      compatibility_warning: string | null;
      validation_available: boolean;
      validation_message: string;
      e2_meta: ModelMetadata;
      e3_meta: ModelMetadata;
      e2: ModelSideResult;
      e3: ModelSideResult;
    }
  | DetectFailure;

export type FrameDetectResponse = FrameDetectSuccess | DetectFailure;

export type VideoTimelineEntry = {
  timestamp_ms: number;
  timestamp: string;
  frame_index: number;
  detections_count: number;
  max_confidence: number;
  avg_confidence: number;
  detections: Detection[];
};

export type VideoJobProgress = {
  success: boolean;
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  percent: number;
  processed_frames: number;
  total_frames: number;
  detections_so_far: number;
  message: string;
};

export type VideoDetectResult = {
  success: true;
  job_id: string;
  video_url: string;
  detection_method: "video";
  model_mode?: "e2" | "e3" | "compare";
  confidence_threshold: number;
  sample_interval_sec: number;
  duration_sec: number;
  total_frames_analyzed: number;
  frames_with_detection: number;
  total_detections: number;
  detection_class: string;
  average_confidence: number;
  timeline: VideoTimelineEntry[];
  output_mime: string;
  output_filename: string;
  e2_summary?: {
    total_detections: number;
    frames_with_detection: number;
    average_confidence: number;
    avg_inference_ms: number;
  };
  e3_summary?: {
    total_detections: number;
    frames_with_detection: number;
    average_confidence: number;
    avg_inference_ms: number;
  };
};

export const MIN_CONFIDENCE_THRESHOLD = 0.05;
export const MAX_CONFIDENCE_THRESHOLD = 0.9;
export const DEFAULT_CONFIDENCE_THRESHOLD = 0.2;
export const CONFIDENCE_THRESHOLD_STEP = 0.05;
export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const DEFAULT_MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;

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

const ALLOWED_VIDEO_EXTS = [".mp4", ".mov", ".avi", ".webm"];

export function validateLeafVideo(file: File, maxBytes: number): string | null {
  if (file.size === 0) return "The video file is corrupted or cannot be read.";
  if (file.size > maxBytes) {
    const mb = Math.max(1, Math.round(maxBytes / (1024 * 1024)));
    return `The video exceeds the upload limit of ${mb} MB.`;
  }
  const lower = file.name.toLowerCase();
  const hasAllowedExt = ALLOWED_VIDEO_EXTS.some((ext) => lower.endsWith(ext));
  if (!hasAllowedExt) {
    return "Unsupported video format. Upload an MP4, MOV, AVI, or WEBM file.";
  }
  return null;
}
