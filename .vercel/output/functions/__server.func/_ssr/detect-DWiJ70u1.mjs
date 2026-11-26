import { i as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { _ as Camera, a as ScanSearch, b as ArrowLeft, c as Radio, d as LoaderCircle, f as Leaf, g as Clock, h as Download, i as Square, l as Play, m as Film, n as Upload, o as RotateCcw, p as Image, r as TriangleAlert, s as RefreshCw, v as CameraOff } from "../_libs/lucide-react.mjs";
import { a as Bar, i as CartesianGrid, n as YAxis, o as ResponsiveContainer, r as XAxis, s as Tooltip, t as BarChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/detect-DWiJ70u1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var MIN_CONFIDENCE_THRESHOLD = .05;
var MAX_CONFIDENCE_THRESHOLD = .9;
var DEFAULT_CONFIDENCE_THRESHOLD = .2;
var CONFIDENCE_THRESHOLD_STEP = .05;
var DEFAULT_MAX_UPLOAD_BYTES = 10485760;
function formatThreshold(value) {
	const pct = Math.round(value * 100);
	return `${value.toFixed(2)} (${pct}%)`;
}
function formatConfidence(value) {
	return `${(value <= 1 ? value * 100 : value).toFixed(1)}%`;
}
function formatBytes(bytes) {
	if (bytes < 1048576) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	return `${(bytes / 1048576).toFixed(1)} MB`;
}
async function sniff(file) {
	const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
	if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpeg";
	if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "png";
	return "other";
}
async function validateLeafImage(file, maxBytes) {
	if (file.size === 0) return "The file is corrupted or cannot be read.";
	if (file.size > maxBytes) return `The file exceeds the upload limit of ${Math.max(1, Math.round(maxBytes / 1048576))} MB.`;
	if (await sniff(file) === "other") return "Unsupported file. Upload a JPG, JPEG, or PNG image.";
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
var ALLOWED_VIDEO_EXTS = [
	".mp4",
	".mov",
	".avi",
	".webm"
];
function validateLeafVideo(file, maxBytes) {
	if (file.size === 0) return "The video file is corrupted or cannot be read.";
	if (file.size > maxBytes) return `The video exceeds the upload limit of ${Math.max(1, Math.round(maxBytes / 1048576))} MB.`;
	const lower = file.name.toLowerCase();
	if (!ALLOWED_VIDEO_EXTS.some((ext) => lower.endsWith(ext))) return "Unsupported video format. Upload an MP4, MOV, AVI, or WEBM file.";
	return null;
}
var LIVE_INTERVAL_OPTIONS = [
	{
		value: 500,
		label: "500 ms (Responsive)"
	},
	{
		value: 750,
		label: "750 ms (Balanced)"
	},
	{
		value: 1e3,
		label: "1000 ms (Low load)"
	},
	{
		value: 1500,
		label: "1500 ms (Battery saver)"
	}
];
function CameraDetectionPanel() {
	const sliderId = (0, import_react.useId)();
	const intervalId = (0, import_react.useId)();
	const videoRef = (0, import_react.useRef)(null);
	const overlayCanvasRef = (0, import_react.useRef)(null);
	const captureCanvasRef = (0, import_react.useRef)(null);
	const captureResultRef = (0, import_react.useRef)(null);
	const streamRef = (0, import_react.useRef)(null);
	const liveTimerRef = (0, import_react.useRef)(null);
	const inFlightRef = (0, import_react.useRef)(false);
	const [cameraActive, setCameraActive] = (0, import_react.useState)(false);
	const [starting, setStarting] = (0, import_react.useState)(false);
	const [facingMode, setFacingMode] = (0, import_react.useState)("user");
	const [liveActive, setLiveActive] = (0, import_react.useState)(false);
	const [liveIntervalMs, setLiveIntervalMs] = (0, import_react.useState)(750);
	const [modelMode, setModelMode] = (0, import_react.useState)("e3");
	const [confidenceThreshold, setConfidenceThreshold] = (0, import_react.useState)(DEFAULT_CONFIDENCE_THRESHOLD);
	const [liveDetections, setLiveDetections] = (0, import_react.useState)([]);
	const [liveCompareCounts, setLiveCompareCounts] = (0, import_react.useState)(null);
	const [lastInferenceMs, setLastInferenceMs] = (0, import_react.useState)(null);
	const [captureRunning, setCaptureRunning] = (0, import_react.useState)(false);
	const [captureResult, setCaptureResult] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const stopTracks = (0, import_react.useCallback)(() => {
		if (liveTimerRef.current !== null) {
			window.clearInterval(liveTimerRef.current);
			liveTimerRef.current = null;
		}
		setLiveActive(false);
		if (streamRef.current) {
			for (const track of streamRef.current.getTracks()) track.stop();
			streamRef.current = null;
		}
		if (videoRef.current) videoRef.current.srcObject = null;
		const overlay = overlayCanvasRef.current;
		if (overlay) overlay.getContext("2d")?.clearRect(0, 0, overlay.width, overlay.height);
		setCameraActive(false);
		setLiveDetections([]);
		setLastInferenceMs(null);
	}, []);
	(0, import_react.useEffect)(() => {
		return () => {
			stopTracks();
		};
	}, [stopTracks]);
	function drawOverlay(detections, frameW, frameH, color = "#e85d04", prefix = "", clearFirst = true) {
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
			ctx.fillRect(sx1, labelY, metrics.width + 12, boxH);
			ctx.fillStyle = color === "#14746f" ? "#ffffff" : "#17261e";
			ctx.fillText(label, sx1 + padX, labelY + 14);
		}
	}
	async function startCamera(targetFacing = facingMode) {
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
					height: { ideal: 720 }
				}
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
			if (name === "NotAllowedError" || name === "PermissionDeniedError") setError("Camera permission was denied. Allow camera access in your browser settings and try again.");
			else if (name === "NotFoundError" || name === "DevicesNotFoundError") setError("No camera device was found on this device.");
			else if (name === "NotReadableError" || name === "TrackStartError") setError("The camera is currently in use by another application.");
			else setError("Unable to start the camera. Check device permissions and HTTPS connection.");
			stopTracks();
		} finally {
			setStarting(false);
		}
	}
	async function switchCamera() {
		await startCamera(facingMode === "environment" ? "user" : "environment");
	}
	function grabFrameBlob(maxSide = 960) {
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
		const dataUrl = canvas.toDataURL("image/jpeg", .85);
		return new Promise((resolve) => {
			canvas.toBlob((blob) => {
				if (!blob) resolve(null);
				else resolve({
					blob,
					dataUrl
				});
			}, "image/jpeg", .85);
		});
	}
	const sendLiveFrame = (0, import_react.useCallback)(async () => {
		if (inFlightRef.current || !streamRef.current) return;
		inFlightRef.current = true;
		try {
			const frame = await grabFrameBlob(960);
			if (!frame) return;
			const body = new FormData();
			body.append("file", new File([frame.blob], "camera-frame.jpg", { type: "image/jpeg" }));
			body.append("confidence_threshold", confidenceThreshold.toFixed(2));
			body.append("model_mode", modelMode);
			const payload = await (await fetch("/api/detect/frame", {
				method: "POST",
				body
			})).json();
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
					e3Ms: payload.e3.inference_ms
				});
				setLiveDetections(payload.e3.detections);
				drawOverlay(payload.e2.detections, payload.frame_width, payload.frame_height, "#14746f", "[E2] ", true);
				drawOverlay(payload.e3.detections, payload.frame_width, payload.frame_height, "#e85d04", "[E3] ", false);
			} else {
				setLiveCompareCounts(null);
				setLiveDetections(payload.detections);
				drawOverlay(payload.detections, payload.frame_width, payload.frame_height, modelMode === "e2" ? "#14746f" : "#e85d04", modelMode === "e2" ? "[E2] " : "", true);
			}
		} catch {
			setError("Detection service could not be reached during live detection.");
		} finally {
			inFlightRef.current = false;
		}
	}, [confidenceThreshold, modelMode]);
	(0, import_react.useEffect)(() => {
		if (!liveActive || !cameraActive) {
			if (liveTimerRef.current !== null) {
				window.clearInterval(liveTimerRef.current);
				liveTimerRef.current = null;
			}
			return;
		}
		sendLiveFrame();
		liveTimerRef.current = window.setInterval(() => {
			sendLiveFrame();
		}, liveIntervalMs);
		return () => {
			if (liveTimerRef.current !== null) {
				window.clearInterval(liveTimerRef.current);
				liveTimerRef.current = null;
			}
		};
	}, [
		liveActive,
		cameraActive,
		liveIntervalMs,
		sendLiveFrame
	]);
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
			const payload = await (await fetch("/api/detect", {
				method: "POST",
				body
			})).json();
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
				thresholdUsed: typeof payload.confidence_threshold === "number" ? payload.confidence_threshold : confidenceThreshold
			});
			window.setTimeout(() => {
				captureResultRef.current?.scrollIntoView({
					behavior: "smooth",
					block: "nearest"
				});
			}, 50);
		} catch {
			setError("The detection service could not be reached.");
		} finally {
			setCaptureRunning(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "alert",
			className: "flex items-start gap-3 rounded-2xl border border-accent bg-surface px-4 py-3 text-sm text-ink",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
				className: "mt-0.5 size-4 shrink-0 text-accent",
				"aria-hidden": "true"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: error })]
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative overflow-hidden rounded-2xl border border-line bg-surface shadow-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-line px-4 py-2.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-sm font-semibold text-ink",
							children: [
								"Live Camera (",
								facingMode === "user" ? "Mirror / Front" : "Rear",
								")"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: liveActive ? "inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground" : cameraActive ? "inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-ink" : "inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1 text-xs font-medium text-muted",
							children: liveActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, {
									className: "size-3.5 animate-pulse",
									"aria-hidden": "true"
								}),
								"Live · ",
								liveDetections.length,
								" box",
								liveDetections.length === 1 ? "" : "es",
								lastInferenceMs !== null ? ` · ${lastInferenceMs}ms` : ""
							] }) : cameraActive ? "Camera ready" : "Camera off"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative flex min-h-72 items-center justify-center bg-canvas",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
								ref: videoRef,
								playsInline: true,
								muted: true,
								autoPlay: true,
								style: { transform: facingMode === "user" ? "scaleX(-1)" : void 0 },
								className: cameraActive ? "max-h-[54vh] w-full object-contain" : "hidden"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
								ref: overlayCanvasRef,
								className: "pointer-events-none absolute inset-0 h-full w-full"
							}),
							!cameraActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col items-center gap-3 px-6 py-10 text-center",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex size-14 items-center justify-center rounded-2xl bg-surface text-primary shadow-sm",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, {
											className: "size-6",
											"aria-hidden": "true"
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-display text-2xl text-ink",
										children: "Mirror Camera Detection"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "max-w-md text-sm leading-relaxed text-muted",
										children: "Start your camera to inspect corn leaves in real time (mirrored view by default) or capture a still frame."
									})
								]
							}) : null
						]
					})]
				}), captureResult ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					ref: captureResultRef,
					className: "grid gap-4 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
						className: "overflow-hidden rounded-2xl border border-line bg-surface shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
							className: "border-b border-line px-4 py-2.5 text-sm font-semibold text-ink",
							children: "Captured original"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: captureResult.originalUrl,
							alt: "Captured leaf frame",
							className: "w-full object-contain"
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
						className: "overflow-hidden rounded-2xl border border-line bg-surface shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figcaption", {
							className: "flex items-center justify-between border-b border-line px-4 py-2.5 text-sm font-semibold text-ink",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
								"Annotated capture (",
								captureResult.total,
								")"
							] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: captureResult.annotatedUrl,
								download: "faw-camera-annotated.jpg",
								className: "inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
									className: "size-3.5",
									"aria-hidden": "true"
								}), "Save"]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: captureResult.annotatedUrl,
							alt: "Annotated capture",
							className: "w-full object-contain"
						})]
					})]
				}) : null]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex flex-col gap-2",
						children: !cameraActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50",
							onClick: () => void startCamera(facingMode),
							disabled: starting,
							children: [starting ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
								className: "size-4 animate-spin",
								"aria-hidden": "true"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Camera, {
								className: "size-4",
								"aria-hidden": "true"
							}), starting ? "Starting Camera..." : "Start Camera"]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: liveActive ? "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent px-4 text-sm font-semibold text-primary-foreground hover:opacity-90" : "inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90",
								onClick: () => setLiveActive((prev) => !prev),
								children: [liveActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Square, {
									className: "size-4",
									"aria-hidden": "true"
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, {
									className: "size-4",
									"aria-hidden": "true"
								}), liveActive ? "Stop Live Detection" : "Start Live Detection"]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-3 text-xs font-semibold text-ink hover:bg-surface disabled:opacity-50",
									onClick: () => void captureAndAnalyze(),
									disabled: captureRunning,
									children: [captureRunning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
										className: "size-3.5 animate-spin",
										"aria-hidden": "true"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanSearch, {
										className: "size-3.5",
										"aria-hidden": "true"
									}), "Capture"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-3 text-xs font-semibold text-ink hover:bg-surface",
									onClick: () => void switchCamera(),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
										className: "size-3.5",
										"aria-hidden": "true"
									}), "Switch"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-semibold text-ink hover:bg-canvas",
								onClick: stopTracks,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CameraOff, {
									className: "size-3.5",
									"aria-hidden": "true"
								}), "Stop Camera"]
							})
						] })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl bg-canvas p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block text-xs font-semibold tracking-wider text-muted uppercase",
								children: "Model Selection"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2 grid grid-cols-3 gap-1.5",
								children: [
									{
										id: "e3",
										label: "E3 (Prod)"
									},
									{
										id: "e2",
										label: "E2 (Exp 2)"
									},
									{
										id: "compare",
										label: "E2 & E3"
									}
								].map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setModelMode(opt.id),
									className: modelMode === opt.id ? "rounded-xl border-2 border-primary bg-surface px-2 py-2 text-xs font-semibold text-primary shadow-xs" : "rounded-xl border border-line bg-surface/60 px-2 py-2 text-xs font-medium text-ink hover:border-primary/40",
									children: opt.label
								}, opt.id))
							}),
							modelMode === "compare" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-[11px] text-accent",
								children: "Running E2 & E3 simultaneously increases latency and reduces FPS."
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl bg-canvas p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								htmlFor: sliderId,
								className: "text-xs font-semibold text-ink",
								children: "Confidence Threshold"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums",
								children: formatThreshold(confidenceThreshold)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							id: sliderId,
							type: "range",
							min: MIN_CONFIDENCE_THRESHOLD,
							max: MAX_CONFIDENCE_THRESHOLD,
							step: CONFIDENCE_THRESHOLD_STEP,
							value: confidenceThreshold,
							onChange: (event) => setConfidenceThreshold(Number(event.target.value)),
							className: "mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl bg-canvas p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							htmlFor: intervalId,
							className: "block text-xs font-semibold text-ink",
							children: "Live Detection Interval"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							id: intervalId,
							value: liveIntervalMs,
							onChange: (event) => setLiveIntervalMs(Number(event.target.value)),
							className: "mt-1.5 h-9 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-medium text-ink",
							children: LIVE_INTERVAL_OPTIONS.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: opt.value,
								children: opt.label
							}, opt.value))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-t border-line pt-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] font-semibold tracking-widest text-muted uppercase",
								children: liveActive ? "Live Detections" : captureResult ? "Captured Frame" : "Camera Status"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-0.5 font-display text-4xl leading-none text-ink tabular-nums",
								children: liveActive ? liveDetections.length : captureResult ? captureResult.total : 0
							}),
							liveCompareCounts && liveActive ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-1 text-xs font-medium text-ink tabular-nums",
								children: [
									"E2: ",
									liveCompareCounts.e2,
									" (",
									liveCompareCounts.e2Ms,
									" ms) · E3: ",
									liveCompareCounts.e3,
									" (",
									liveCompareCounts.e3Ms,
									" ms)"
								]
							}) : null
						]
					}),
					(liveActive ? liveDetections : captureResult?.detections || []).length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "flex max-h-44 flex-col gap-1.5 overflow-auto",
						children: (liveActive ? liveDetections : captureResult?.detections || []).map((det, idx) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-xs",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "font-semibold text-ink",
								children: [
									idx + 1,
									". ",
									det.class
								]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-semibold text-primary tabular-nums",
								children: formatConfidence(det.confidence)
							})]
						}, `${det.bbox.join("-")}-${idx}`))
					}) : null
				]
			})]
		})]
	});
}
var SAMPLE_INTERVAL_OPTIONS = [
	{
		value: .25,
		label: "0.25s (High detail)"
	},
	{
		value: .5,
		label: "0.50s (Balanced)"
	},
	{
		value: 1,
		label: "1.00s (Fast)"
	},
	{
		value: 2,
		label: "2.00s (Quick scan)"
	}
];
function VideoDetectionPanel({ status }) {
	const inputId = (0, import_react.useId)();
	const sliderId = (0, import_react.useId)();
	const intervalId = (0, import_react.useId)();
	const inputRef = (0, import_react.useRef)(null);
	const previewRef = (0, import_react.useRef)(null);
	const annotatedVideoRef = (0, import_react.useRef)(null);
	const eventSourceRef = (0, import_react.useRef)(null);
	const [phase, setPhase] = (0, import_react.useState)("empty");
	const [file, setFile] = (0, import_react.useState)(null);
	const [previewUrl, setPreviewUrl] = (0, import_react.useState)(null);
	const [dragging, setDragging] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [confidenceThreshold, setConfidenceThreshold] = (0, import_react.useState)(DEFAULT_CONFIDENCE_THRESHOLD);
	const [sampleInterval, setSampleInterval] = (0, import_react.useState)(.5);
	const [modelMode, setModelMode] = (0, import_react.useState)("e3");
	const [progress, setProgress] = (0, import_react.useState)(null);
	const [result, setResult] = (0, import_react.useState)(null);
	const maxVideoBytes = status?.max_video_upload_bytes || 52428800;
	(0, import_react.useEffect)(() => {
		return () => {
			if (previewRef.current) URL.revokeObjectURL(previewRef.current);
			if (eventSourceRef.current) eventSourceRef.current.close();
		};
	}, []);
	function replacePreview(next) {
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
	function acceptVideo(next) {
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
	async function fetchJobResult(jobId) {
		const payload = await (await fetch(`/api/detect/video/${jobId}/result`)).json();
		if (!payload.success) {
			setError(payload.message || "Unable to load video analysis results.");
			setPhase("ready");
			return;
		}
		setResult(payload);
		setPhase("done");
	}
	function pollJobFallback(jobId) {
		const timer = window.setInterval(async () => {
			try {
				const data = await (await fetch(`/api/detect/video/${jobId}`)).json();
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
			message: "Uploading video for analysis..."
		});
		try {
			const body = new FormData();
			body.append("file", file);
			body.append("confidence_threshold", confidenceThreshold.toFixed(2));
			body.append("sample_interval_sec", String(sampleInterval));
			body.append("model_mode", modelMode);
			const payload = await (await fetch("/api/detect/video", {
				method: "POST",
				body
			})).json();
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
						const data = JSON.parse(event.data);
						setProgress(data);
						if (data.status === "completed") {
							es.close();
							eventSourceRef.current = null;
							fetchJobResult(jobId);
						} else if (data.status === "failed") {
							es.close();
							eventSourceRef.current = null;
							setError(data.message || "Video analysis failed.");
							setPhase("ready");
						}
					} catch {}
				};
				es.onerror = () => {
					es.close();
					eventSourceRef.current = null;
					pollJobFallback(jobId);
				};
			} else pollJobFallback(jobId);
		} catch {
			setError("The detection service could not be reached.");
			setPhase("ready");
		}
	}
	function seekToTimestamp(ms) {
		const videoEl = annotatedVideoRef.current;
		if (!videoEl) return;
		videoEl.currentTime = Math.max(0, ms / 1e3);
		videoEl.play().catch(() => void 0);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			role: "alert",
			className: "flex items-start gap-3 rounded-2xl border border-accent bg-surface px-4 py-3 text-sm text-ink",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
				className: "mt-0.5 size-4 shrink-0 text-accent",
				"aria-hidden": "true"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: error })]
		}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "flex flex-col gap-4",
				children: [
					phase === "done" && result ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 md:grid-cols-2",
						children: [previewUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
							className: "overflow-hidden rounded-2xl border border-line bg-surface shadow-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
								className: "border-b border-line px-4 py-2.5 text-sm font-semibold text-ink",
								children: "Original video"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
								src: previewUrl,
								controls: true,
								playsInline: true,
								className: "max-h-[50vh] w-full bg-canvas object-contain"
							})]
						}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
							className: "overflow-hidden rounded-2xl border border-line bg-surface shadow-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
								className: "border-b border-line px-4 py-2.5 text-sm font-semibold text-ink",
								children: "Annotated video result"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
								ref: annotatedVideoRef,
								src: `${result.video_url}?inline=1`,
								controls: true,
								playsInline: true,
								className: "max-h-[50vh] w-full bg-canvas object-contain"
							})]
						})]
					}) : previewUrl && file ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
						className: "overflow-hidden rounded-2xl border border-line bg-surface shadow-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figcaption", {
							className: "border-b border-line px-4 py-2.5 text-sm font-semibold text-ink",
							children: [
								"Video preview · ",
								file.name,
								" (",
								formatBytes(file.size),
								")"
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("video", {
							src: previewUrl,
							controls: true,
							playsInline: true,
							className: "max-h-[52vh] w-full bg-canvas object-contain"
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: dragging ? "flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-primary/5 px-6 py-10 text-center" : "flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-line bg-surface px-6 py-10 text-center",
						onDragEnter: (event) => {
							event.preventDefault();
							setDragging(true);
						},
						onDragOver: (event) => {
							event.preventDefault();
							setDragging(true);
						},
						onDragLeave: (event) => {
							event.preventDefault();
							setDragging(false);
						},
						onDrop: (event) => {
							event.preventDefault();
							setDragging(false);
							acceptVideo(event.dataTransfer.files?.[0]);
						},
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex size-14 items-center justify-center rounded-2xl bg-canvas text-primary",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Film, {
									className: "size-6",
									"aria-hidden": "true"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-2xl text-ink",
								children: "Upload a corn leaf video"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-sm leading-relaxed text-muted",
								children: [
									"MP4, MOV, AVI, or WEBM up to ",
									Math.max(1, Math.round(maxVideoBytes / 1048576)),
									" MB (max 2 minutes)."
								]
							})] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90",
								onClick: () => inputRef.current?.click(),
								"aria-controls": inputId,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
									className: "size-4",
									"aria-hidden": "true"
								}), "Browse video"]
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						ref: inputRef,
						id: inputId,
						className: "sr-only",
						type: "file",
						accept: "video/mp4,video/quicktime,video/x-msvideo,video/webm,.mp4,.mov,.avi,.webm",
						onChange: (event) => {
							const next = event.target.files?.[0];
							event.target.value = "";
							acceptVideo(next);
						}
					}),
					phase === "running" && progress ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl border border-line bg-surface p-4 shadow-sm",
						"aria-live": "polite",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between gap-3 text-sm",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-semibold text-ink",
									children: progress.message
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "font-semibold text-primary tabular-nums",
									children: [progress.percent, "%"]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-line",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "h-full rounded-full bg-primary transition-all duration-300",
									style: { width: `${Math.max(4, progress.percent)}%` }
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-xs text-muted tabular-nums",
								children: [
									"Sampled frames: ",
									progress.processed_frames,
									" / ",
									progress.total_frames || "?",
									" · Detections found:",
									" ",
									progress.detections_so_far
								]
							})
						]
					}) : null
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-4",
				children: [phase !== "done" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl bg-canvas p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "block text-xs font-semibold tracking-wider text-muted uppercase",
							children: "Model Selection"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 grid grid-cols-3 gap-1.5",
							children: [
								{
									id: "e3",
									label: "E3 (Prod)"
								},
								{
									id: "e2",
									label: "E2 (Exp 2)"
								},
								{
									id: "compare",
									label: "E2 & E3"
								}
							].map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: phase === "running",
								onClick: () => setModelMode(opt.id),
								className: modelMode === opt.id ? "rounded-xl border-2 border-primary bg-surface px-2 py-2 text-xs font-semibold text-primary shadow-xs" : "rounded-xl border border-line bg-surface/60 px-2 py-2 text-xs font-medium text-ink hover:border-primary/40",
								children: opt.label
							}, opt.id))
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl bg-canvas p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								htmlFor: sliderId,
								className: "text-xs font-semibold text-ink",
								children: "Confidence Threshold"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums",
								children: formatThreshold(confidenceThreshold)
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							id: sliderId,
							type: "range",
							min: MIN_CONFIDENCE_THRESHOLD,
							max: MAX_CONFIDENCE_THRESHOLD,
							step: CONFIDENCE_THRESHOLD_STEP,
							value: confidenceThreshold,
							disabled: phase === "running",
							onChange: (event) => setConfidenceThreshold(Number(event.target.value)),
							className: "mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary disabled:opacity-50"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rounded-2xl bg-canvas p-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							htmlFor: intervalId,
							className: "block text-xs font-semibold text-ink",
							children: "Frame Sampling Interval"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
							id: intervalId,
							value: sampleInterval,
							disabled: phase === "running",
							onChange: (event) => setSampleInterval(Number(event.target.value)),
							className: "mt-2 h-9 w-full rounded-xl border border-line bg-surface px-2.5 text-xs font-medium text-ink",
							children: SAMPLE_INTERVAL_OPTIONS.map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: opt.value,
								children: opt.label
							}, opt.value))
						})]
					}),
					file && previewUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50",
							onClick: () => void onStartAnalysis(),
							disabled: phase === "running",
							children: [phase === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
								className: "size-4 animate-spin motion-reduce:animate-none",
								"aria-hidden": "true"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, {
								className: "size-4",
								"aria-hidden": "true"
							}), phase === "running" ? "Analyzing..." : "Mulai Analisis"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-4 text-sm font-semibold text-ink hover:bg-surface disabled:opacity-50",
							onClick: resetAll,
							disabled: phase === "running",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
								className: "size-4",
								"aria-hidden": "true"
							}), "Reset"]
						})]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90",
						onClick: () => inputRef.current?.click(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
							className: "size-4",
							"aria-hidden": "true"
						}), "Browse video"]
					})
				] }) : null, phase === "done" && result ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-semibold tracking-widest text-muted uppercase",
							children: "Detection Summary"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 font-display text-5xl leading-none text-ink tabular-nums",
							children: result.total_detections
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-1 text-xs text-muted",
							children: "Total detections across sampled frames"
						})
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "grid grid-cols-2 gap-2.5 text-sm",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-2xl bg-canvas px-3 py-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs text-muted",
									children: "Method"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "mt-0.5 font-semibold text-ink capitalize",
									children: result.detection_method
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-2xl bg-canvas px-3 py-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs text-muted",
									children: "Threshold"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "mt-0.5 font-semibold text-ink tabular-nums",
									children: formatThreshold(result.confidence_threshold)
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-2xl bg-canvas px-3 py-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs text-muted",
									children: "Frames Analyzed"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "mt-0.5 font-semibold text-ink tabular-nums",
									children: result.total_frames_analyzed
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-2xl bg-canvas px-3 py-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs text-muted",
									children: "Frames w/ Detection"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "mt-0.5 font-semibold text-ink tabular-nums",
									children: result.frames_with_detection
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-2xl bg-canvas px-3 py-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs text-muted",
									children: "Class"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "mt-0.5 font-semibold text-ink",
									children: result.detection_class
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-2xl bg-canvas px-3 py-2.5",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
									className: "text-xs text-muted",
									children: "Avg Confidence"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
									className: "mt-0.5 font-semibold text-ink tabular-nums",
									children: result.total_detections > 0 ? formatConfidence(result.average_confidence) : "—"
								})]
							})
						]
					}),
					result.model_mode === "compare" && result.e2_summary && result.e3_summary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-2.5 text-xs",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl border border-[#14746f]/30 bg-canvas p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-semibold text-[#14746f]",
									children: "E2 (e2best.pt)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 tabular-nums text-ink",
									children: [result.e2_summary.total_detections, " detections"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "tabular-nums text-muted",
									children: [result.e2_summary.avg_inference_ms, " ms/frame"]
								})
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-2xl border border-primary/30 bg-canvas p-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "font-semibold text-primary",
									children: "E3 (best.pt)"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-1 tabular-nums text-ink",
									children: [result.e3_summary.total_detections, " detections"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "tabular-nums text-muted",
									children: [result.e3_summary.avg_inference_ms, " ms/frame"]
								})
							]
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-semibold tracking-widest text-muted uppercase",
						children: "Detection Timeline"
					}), result.timeline.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-2 rounded-2xl bg-canvas px-4 py-3 text-sm text-muted",
						children: [
							"No suspected damage detected across ",
							result.total_frames_analyzed,
							" sampled frames."
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "mt-2 flex max-h-60 flex-col gap-2 overflow-auto",
						children: result.timeline.map((entry) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => seekToTimestamp(entry.timestamp_ms),
							className: "flex w-full items-center justify-between gap-2 rounded-xl bg-canvas px-3 py-2.5 text-left text-sm transition-colors hover:bg-primary/10",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "inline-flex items-center gap-1.5 font-semibold text-ink tabular-nums",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Clock, {
									className: "size-3.5 text-primary",
									"aria-hidden": "true"
								}), entry.timestamp]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-xs text-muted",
								children: [
									result.detection_class,
									" (",
									entry.detections_count,
									") · ",
									formatConfidence(entry.max_confidence)
								]
							})]
						}) }, `${entry.frame_index}-${entry.timestamp_ms}`))
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
						href: result.video_url,
						download: result.output_filename,
						className: "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
							className: "size-4",
							"aria-hidden": "true"
						}), "Download annotated video"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-canvas",
						onClick: resetAll,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
							className: "size-4",
							"aria-hidden": "true"
						}), "Analyze another video"]
					})
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-semibold tracking-widest text-muted uppercase",
							children: "Video Pipeline"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "font-display text-2xl text-ink",
							children: file ? file.name : "Waiting for a video"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm leading-relaxed text-muted",
							children: "Frames are sampled periodically and analyzed with the trained YOLO26 model (`best.pt`). Detected areas indicate suspected leaf damage (`infected`), not a definitive pest species diagnosis."
						})
					]
				})]
			})]
		})]
	});
}
function isStatus(value) {
	if (!value || typeof value !== "object") return false;
	const record = value;
	return typeof record.message === "string" && typeof record.model_ready === "boolean";
}
function DetectionStudio() {
	const inputId = (0, import_react.useId)();
	const inputRef = (0, import_react.useRef)(null);
	const previewRef = (0, import_react.useRef)(null);
	const [status, setStatus] = (0, import_react.useState)(null);
	const [mode, setMode] = (0, import_react.useState)("image");
	const [modelMode, setModelMode] = (0, import_react.useState)("e3");
	const [phase, setPhase] = (0, import_react.useState)("empty");
	const [file, setFile] = (0, import_react.useState)(null);
	const [previewUrl, setPreviewUrl] = (0, import_react.useState)(null);
	const [dragging, setDragging] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [result, setResult] = (0, import_react.useState)(null);
	const [confidenceThreshold, setConfidenceThreshold] = (0, import_react.useState)(DEFAULT_CONFIDENCE_THRESHOLD);
	const maxBytes = status?.max_upload_bytes || 10485760;
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		async function loadStatus() {
			try {
				const payload = await (await fetch("/api/status")).json();
				if (!cancelled && isStatus(payload)) setStatus(payload);
			} catch {
				if (!cancelled) setStatus({
					service: "unavailable",
					model_ready: false,
					class_name: "infected",
					confidence_threshold: null,
					max_upload_bytes: DEFAULT_MAX_UPLOAD_BYTES,
					weights_hint: "backend/models/best.pt",
					message: "The detection service could not be reached."
				});
			}
		}
		loadStatus();
		return () => {
			cancelled = true;
		};
	}, [phase]);
	(0, import_react.useEffect)(() => {
		return () => {
			if (previewRef.current) URL.revokeObjectURL(previewRef.current);
		};
	}, []);
	function replacePreview(next) {
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
	async function acceptFile(next) {
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
				const payload = await (await fetch("/api/detect/compare", {
					method: "POST",
					body
				})).json();
				if (!payload.success) {
					setError(payload.message || "Unable to compare models on the uploaded image.");
					setPhase(result ? "done" : "ready");
					return;
				}
				setResult({
					kind: "compare",
					data: payload
				});
				setPhase("done");
				return;
			}
			body.append("model_mode", modelMode);
			const payload = await (await fetch("/api/detect", {
				method: "POST",
				body
			})).json();
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
				thresholdUsed: typeof payload.confidence_threshold === "number" ? payload.confidence_threshold : confidenceThreshold,
				detections: payload.detections,
				annotatedUrl: `data:${mime};base64,${payload.annotated_image}`
			});
			setPhase("done");
		} catch {
			setError("The detection service could not be reached. Nothing was inferred locally in the browser.");
			setPhase(result ? "done" : "ready");
		}
	}
	function downloadUrl(url, filename) {
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		link.click();
	}
	const showDone = (phase === "done" || phase === "running" && result !== null) && result && previewUrl;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "border-b border-line bg-surface",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: "/",
							className: "group inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-canvas px-3.5 text-xs font-semibold text-ink transition-colors duration-200 hover:border-primary hover:text-primary",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, {
								className: "size-3.5 transition-transform duration-300 ease-out group-hover:-translate-x-1",
								"aria-hidden": "true"
							}), "Home"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Leaf, {
								className: "size-5",
								"aria-hidden": "true"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-2xl leading-none font-semibold text-ink sm:text-3xl",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/",
								children: "JAGUNGZ"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted",
							children: "Corn Leaf Pest Detection Studio"
						})] })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status })]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				"aria-label": "Detection method",
				className: "grid grid-cols-1 gap-2 sm:grid-cols-3",
				children: [
					{
						id: "image",
						title: "Image Detection",
						subtitle: "Upload photo · E2 / E3 / Compare",
						icon: Image
					},
					{
						id: "video",
						title: "Video Detection",
						subtitle: "Analyze frames & timestamps",
						icon: Film
					},
					{
						id: "camera",
						title: "Live Camera",
						subtitle: "Mirror webcam or phone scan",
						icon: Camera
					}
				].map((tab) => {
					const Icon = tab.icon;
					const active = mode === tab.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-pressed": active,
						onClick: () => setMode(tab.id),
						className: active ? "flex items-center gap-3 rounded-2xl border-2 border-primary bg-surface px-4 py-2.5 text-left shadow-sm transition-colors" : "flex items-center gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-2.5 text-left transition-colors hover:border-primary/40 hover:bg-surface",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: active ? "flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" : "flex size-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-primary",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-4",
								"aria-hidden": "true"
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "min-w-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block text-sm font-semibold text-ink",
								children: tab.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "block truncate text-xs text-muted",
								children: tab.subtitle
							})]
						})]
					}, tab.id);
				})
			}), mode === "video" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VideoDetectionPanel, { status }) : mode === "camera" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CameraDetectionPanel, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "alert",
					className: "flex items-start gap-3 rounded-2xl border border-accent bg-surface px-4 py-3 text-sm text-ink",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
						className: "mt-0.5 size-4 shrink-0 text-accent",
						"aria-hidden": "true"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: error })]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					ref: inputRef,
					id: inputId,
					className: "sr-only",
					type: "file",
					accept: "image/jpeg,image/png,.jpg,.jpeg,.png",
					onChange: (event) => {
						const next = event.target.files?.[0];
						event.target.value = "";
						acceptFile(next);
					}
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
						className: "flex flex-col gap-4",
						children: showDone && result.kind === "single" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "grid gap-4 md:grid-cols-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageFrame, {
								title: "Original image",
								src: previewUrl,
								alt: "Uploaded corn leaf"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageFrame, {
								title: `Detection result (${result.modelMode.toUpperCase()})`,
								src: result.annotatedUrl,
								alt: "Annotated detection result",
								scanning: phase === "running"
							})]
						}) : showDone && result.kind === "compare" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex flex-col gap-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "grid gap-4 md:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareImageCard, {
									heading: "E2 DETECTION RESULT",
									subtitle: "Experiment 2 (e2best.pt)",
									side: result.data.e2,
									badgeClass: "bg-[#14746f] text-white",
									onDownload: () => {
										if (result.data.e2.annotated_image) downloadUrl(`data:${result.data.e2.annotated_mime || "image/jpeg"};base64,${result.data.e2.annotated_image}`, "faw-e2-annotated.jpg");
									}
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompareImageCard, {
									heading: "E3 DETECTION RESULT",
									subtitle: "Experiment 3 (best.pt · Production)",
									side: result.data.e3,
									badgeClass: "bg-primary text-primary-foreground",
									onDownload: () => {
										if (result.data.e3.annotated_image) downloadUrl(`data:${result.data.e3.annotated_mime || "image/jpeg"};base64,${result.data.e3.annotated_image}`, "faw-e3-annotated.jpg");
									}
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComparisonMetricsSection, { data: result.data })]
						}) : previewUrl && file ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageFrame, {
							title: `Original image · ${file.name} (${formatBytes(file.size)})`,
							src: previewUrl,
							alt: "Uploaded corn leaf preview",
							scanning: phase === "running"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dropzone, {
							inputId,
							dragging,
							maxBytes,
							onBrowse: () => inputRef.current?.click(),
							onDragState: setDragging,
							onFile: (next) => void acceptFile(next)
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
						className: "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm lg:sticky lg:top-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ModelSelector, {
								value: modelMode,
								disabled: phase === "running",
								onChange: setModelMode
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ConfidenceSlider, {
								value: confidenceThreshold,
								disabled: phase === "running",
								onChange: setConfidenceThreshold,
								compact: true
							}),
							file && previewUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-col gap-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
										onClick: () => void onDetect(),
										disabled: phase === "running",
										children: [phase === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
											className: "size-4 animate-spin motion-reduce:animate-none",
											"aria-hidden": "true"
										}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanSearch, {
											className: "size-4",
											"aria-hidden": "true"
										}), phase === "running" ? "Detecting..." : showDone ? "Re-detect" : modelMode === "compare" ? "Run Comparison" : "Detect"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-line bg-canvas px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface disabled:opacity-50",
										onClick: resetAll,
										disabled: phase === "running",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
											className: "size-4",
											"aria-hidden": "true"
										}), "Reset"]
									})]
								})
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90",
								onClick: () => inputRef.current?.click(),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
									className: "size-4",
									"aria-hidden": "true"
								}), "Browse image"]
							}),
							showDone && result.kind === "single" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SingleResultsSummary, {
								result,
								onDownload: () => downloadUrl(result.annotatedUrl, `faw-${result.modelMode}-annotated.jpg`)
							}) : showDone && result.kind === "compare" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "rounded-2xl bg-canvas p-3.5 text-xs text-muted",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "font-semibold text-ink",
										children: "Comparison Complete"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-1",
										children: [
											"E2: ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-ink",
												children: result.data.e2.total_detections
											}),
											" boxes (",
											result.data.e2.inference_ms,
											" ms) · E3:",
											" ",
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
												className: "text-ink",
												children: result.data.e3.total_detections
											}),
											" boxes (",
											result.data.e3.inference_ms,
											" ms)"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1.5 text-[11px]",
										children: result.data.validation_message
									})
								]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "text-xs leading-relaxed text-muted",
								children: [
									"One class only: ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
										className: "text-ink",
										children: "infected"
									}),
									" (suspected leaf damage). No boxes does not guarantee the leaf is healthy."
								]
							})
						]
					})]
				})
			] })]
		})]
	});
}
function ModelSelector({ value, disabled, onChange }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-2xl bg-canvas p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "block text-xs font-semibold tracking-wider text-muted uppercase",
			children: "Model Selection"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-2 grid grid-cols-3 gap-1.5",
			children: [
				{
					id: "e3",
					label: "E3 (Prod)"
				},
				{
					id: "e2",
					label: "E2 (Exp 2)"
				},
				{
					id: "compare",
					label: "E2 & E3"
				}
			].map((opt) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled,
				onClick: () => onChange(opt.id),
				className: value === opt.id ? "rounded-xl border-2 border-primary bg-surface px-2 py-2 text-xs font-semibold text-primary shadow-xs" : "rounded-xl border border-line bg-surface/60 px-2 py-2 text-xs font-medium text-ink hover:border-primary/40",
				children: opt.label
			}, opt.id))
		})]
	});
}
function StatusPill({ status }) {
	const ready = status?.model_ready === true;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: ready ? "inline-flex h-9 items-center rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground" : "inline-flex h-9 items-center rounded-full border border-line bg-canvas px-3.5 text-xs font-semibold text-ink",
		children: !status ? "Checking model" : ready ? "Weights loaded" : "Weights not loaded"
	});
}
function Dropzone({ inputId, dragging, maxBytes, onBrowse, onDragState, onFile }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: dragging ? "flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-primary/5 px-6 py-10 text-center" : "flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-line bg-surface px-6 py-10 text-center",
		onDragEnter: (event) => {
			event.preventDefault();
			onDragState(true);
		},
		onDragOver: (event) => {
			event.preventDefault();
			onDragState(true);
		},
		onDragLeave: (event) => {
			event.preventDefault();
			onDragState(false);
		},
		onDrop: (event) => {
			event.preventDefault();
			onDragState(false);
			onFile(event.dataTransfer.files?.[0]);
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "flex size-14 items-center justify-center rounded-2xl bg-canvas text-primary",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Upload, {
					className: "size-6",
					"aria-hidden": "true"
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-2xl text-ink",
				children: "Upload a corn leaf"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-2 text-sm leading-relaxed text-muted",
				children: [
					"Drag a photo here, or browse. JPG and PNG, up to ",
					Math.max(1, Math.round(maxBytes / 1048576)),
					" MB."
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				className: "inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90",
				onClick: onBrowse,
				"aria-controls": inputId,
				children: "Browse image"
			})
		]
	});
}
function ImageFrame({ title, src, alt, scanning = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("figure", {
		className: "overflow-hidden rounded-2xl border border-line bg-surface shadow-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("figcaption", {
			className: "border-b border-line px-4 py-2.5 text-sm font-semibold text-ink",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex items-center justify-center bg-canvas",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src,
				alt,
				className: "max-h-[54vh] w-full object-contain"
			}), scanning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0 overflow-hidden bg-ink/10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "scanline absolute inset-x-0 h-1/3 bg-linear-to-b from-transparent via-primary/40 to-transparent" })
			}) : null]
		})]
	});
}
function ConfidenceSlider({ value, disabled, onChange, compact = false }) {
	const sliderId = (0, import_react.useId)();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: compact ? "rounded-2xl bg-canvas p-3" : "rounded-2xl border border-line bg-surface p-4 shadow-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					htmlFor: sliderId,
					className: "text-xs font-semibold text-ink",
					children: "Confidence Threshold"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "shrink-0 whitespace-nowrap rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums",
					children: formatThreshold(value)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
				id: sliderId,
				type: "range",
				min: MIN_CONFIDENCE_THRESHOLD,
				max: MAX_CONFIDENCE_THRESHOLD,
				step: CONFIDENCE_THRESHOLD_STEP,
				value,
				disabled,
				"aria-valuetext": formatThreshold(value),
				onChange: (event) => onChange(Number(event.target.value)),
				className: "mt-2.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-primary disabled:cursor-not-allowed disabled:opacity-50"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-1 flex items-center justify-between text-[11px] text-muted tabular-nums",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "0.05" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Default 0.20" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "0.90" })
				]
			})
		]
	});
}
function SingleResultsSummary({ result, onDownload }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3 border-t border-line pt-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-end justify-between gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] font-semibold tracking-widest text-muted uppercase",
					children: "Total detections"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-4xl leading-none text-ink tabular-nums",
					children: result.total
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-xl bg-canvas px-2.5 py-1.5 text-right text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-muted",
						children: result.modelMode.toUpperCase()
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-semibold text-ink tabular-nums",
						children: formatThreshold(result.thresholdUsed)
					})]
				})]
			}),
			result.total === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-xl bg-canvas px-3 py-2.5 text-xs text-muted",
				children: "No suspected FAW damage detected at this threshold."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "flex max-h-48 flex-col gap-1.5 overflow-auto",
				children: result.detections.map((detection, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between rounded-xl bg-canvas px-3 py-2 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "font-semibold text-ink",
						children: [
							index + 1,
							". ",
							detection.class
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold text-primary tabular-nums",
						children: formatConfidence(detection.confidence)
					})]
				}, `${detection.bbox.join("-")}-${index}`))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-canvas px-4 text-xs font-semibold text-ink hover:border-primary",
				onClick: onDownload,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
					className: "size-3.5",
					"aria-hidden": "true"
				}), "Download annotated image"]
			})
		]
	});
}
function CompareImageCard({ heading, subtitle, side, badgeClass, onDownload }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-semibold tracking-wider text-muted uppercase",
				children: heading
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm font-semibold text-ink",
				children: subtitle
			})] }), side.available ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: `rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${badgeClass}`,
				children: [
					side.total_detections,
					" boxes · ",
					side.inference_ms,
					" ms"
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "rounded-full bg-accent/20 px-2.5 py-0.5 text-xs font-semibold text-ink",
				children: "Unavailable"
			})]
		}), side.available && side.annotated_image ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
			src: `data:${side.annotated_mime || "image/jpeg"};base64,${side.annotated_image}`,
			alt: heading,
			className: "max-h-[45vh] w-full rounded-xl bg-canvas object-contain"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: onDownload,
			className: "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-line bg-canvas px-4 text-xs font-semibold text-ink hover:border-primary",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
					className: "size-3.5",
					"aria-hidden": "true"
				}),
				"Download ",
				heading.split(" ")[0],
				" Result"
			]
		})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "rounded-xl bg-canvas p-3 text-xs text-muted",
			children: side.error || "Model unavailable."
		})]
	});
}
function ComparisonMetricsSection({ data }) {
	const speedData = [{
		model: "E2",
		ms: data.e2.available ? data.e2.inference_ms : 0
	}, {
		model: "E3",
		ms: data.e3.available ? data.e3.inference_ms : 0
	}];
	const countData = [{
		model: "E2",
		detections: data.e2.available ? data.e2.total_detections : 0
	}, {
		model: "E3",
		detections: data.e3.available ? data.e3.total_detections : 0
	}];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 shadow-sm",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "font-display text-xl text-ink",
				children: "Inference Comparison Table"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-[460px] border-collapse text-left text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-line text-muted uppercase",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 pr-3",
								children: "Parameter"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 pr-3",
								children: "E2 (e2best.pt)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2 pr-3",
								children: "E3 (best.pt)"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "py-2",
								children: "Note"
							})
						]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tbody", {
						className: "divide-y divide-line",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-medium text-ink",
									children: "Total detections"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 tabular-nums",
									children: data.e2.total_detections
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 tabular-nums",
									children: data.e3.total_detections
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 text-muted",
									children: "Requires ground truth for accuracy"
								})
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-medium text-ink",
									children: "Avg confidence"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 tabular-nums",
									children: data.e2.total_detections > 0 ? formatConfidence(data.e2.average_confidence || 0) : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 tabular-nums",
									children: data.e3.total_detections > 0 ? formatConfidence(data.e3.average_confidence || 0) : "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 text-muted",
									children: "Calibration-dependent"
								})
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 pr-3 font-medium text-ink",
									children: "Inference time"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-2 pr-3 tabular-nums",
									children: [data.e2.inference_ms, " ms"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-2 pr-3 tabular-nums",
									children: [data.e3.inference_ms, " ms"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-2 font-medium text-primary",
									children: data.e2.inference_ms < data.e3.inference_ms ? "E2 faster" : "E3 faster"
								})
							] })
						]
					})]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 md:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "h-44 w-full",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1 text-xs font-semibold text-ink",
						children: "Inference Speed (ms)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "90%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
							data: speedData,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
									strokeDasharray: "3 3",
									stroke: "#e3dccb"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
									dataKey: "model",
									tick: {
										fontSize: 11,
										fill: "#17261e"
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, { tick: {
									fontSize: 11,
									fill: "#5d6b63"
								} }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
									dataKey: "ms",
									fill: "#245c3a",
									radius: [
										6,
										6,
										0,
										0
									]
								})
							]
						})
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "h-44 w-full",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-1 text-xs font-semibold text-ink",
						children: "Detection Count"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
						width: "100%",
						height: "90%",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
							data: countData,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CartesianGrid, {
									strokeDasharray: "3 3",
									stroke: "#e3dccb"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
									dataKey: "model",
									tick: {
										fontSize: 11,
										fill: "#17261e"
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
									allowDecimals: false,
									tick: {
										fontSize: 11,
										fill: "#5d6b63"
									}
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
									dataKey: "detections",
									fill: "#c4841d",
									radius: [
										6,
										6,
										0,
										0
									]
								})
							]
						})
					})]
				})]
			})
		]
	});
}
function DetectPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetectionStudio, {});
}
//#endregion
export { DetectPage as component };
