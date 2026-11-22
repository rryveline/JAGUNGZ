import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as LoaderCircle, i as RotateCcw, n as TriangleAlert, o as Leaf, r as ScanSearch, s as Download, t as Upload } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-z-auPW8d.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DEFAULT_MAX_UPLOAD_BYTES = 10485760;
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
	const [phase, setPhase] = (0, import_react.useState)("empty");
	const [file, setFile] = (0, import_react.useState)(null);
	const [previewUrl, setPreviewUrl] = (0, import_react.useState)(null);
	const [dragging, setDragging] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [result, setResult] = (0, import_react.useState)(null);
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
		setResult(null);
		try {
			const body = new FormData();
			body.append("file", file);
			const payload = await (await fetch("/api/detect", {
				method: "POST",
				body
			})).json();
			if (!payload.success) {
				setError(payload.message || "Unable to process the uploaded image.");
				setPhase("ready");
				return;
			}
			const mime = payload.annotated_mime || "image/jpeg";
			setResult({
				total: payload.total_detections,
				detections: payload.detections,
				annotatedUrl: `data:${mime};base64,${payload.annotated_image}`
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
	const live = phase === "running" ? "Running detection." : error ? error : phase === "done" && result ? result.total === 0 ? "No suspected FAW damage detected." : `${result.total} detections.` : "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
			className: "border-b border-line bg-surface",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-6xl flex-col gap-5 px-4 py-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-start gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Leaf, {
							className: "size-6",
							"aria-hidden": "true"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-semibold tracking-widest text-accent uppercase",
							children: "Corn leaf study"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "font-display text-4xl leading-none font-semibold text-balance text-ink sm:text-5xl",
							children: "Corn Leaf FAW Detection"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 max-w-xl text-base leading-relaxed text-pretty text-muted",
							children: "Detect suspected Fall Armyworm damage on corn leaves using computer vision."
						})
					] })]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status })]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
			className: "mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "sr-only",
					"aria-live": "polite",
					children: live
				}),
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "alert",
					className: "flex items-start gap-3 rounded-2xl border border-accent bg-surface px-4 py-3 text-sm text-ink",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
						className: "mt-0.5 size-4 shrink-0 text-accent",
						"aria-hidden": "true"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: error })]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: showCompare ? "grid items-start gap-4 lg:grid-cols-[1fr_1fr_19rem]" : "grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]",
					children: [showCompare ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageFrame, {
						title: "Original image",
						src: previewUrl,
						alt: "Uploaded corn leaf"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageFrame, {
						title: "Detection result",
						src: result.annotatedUrl,
						alt: "Annotated detection result"
					})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "flex flex-col gap-4",
						children: [
							previewUrl && file ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ImageFrame, {
								title: "Original image",
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
							}),
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
							file && previewUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-col gap-3 sm:flex-row",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
									onClick: () => void onDetect(),
									disabled: phase === "running",
									children: [phase === "running" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
										className: "size-4 animate-spin motion-reduce:animate-none",
										"aria-hidden": "true"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScanSearch, {
										className: "size-4",
										"aria-hidden": "true"
									}), phase === "running" ? "Running detection" : "Detect"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-canvas disabled:opacity-50",
									onClick: resetAll,
									disabled: phase === "running",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
										className: "size-4",
										"aria-hidden": "true"
									}), "Reset"]
								})]
							}) : null
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
						className: "flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm",
						children: [showCompare && result ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResultsPanel, {
							result,
							onDownload: downloadAnnotated,
							onReset: resetAll
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SpecPanel, {
							file,
							status,
							running: phase === "running"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-sm leading-relaxed text-pretty text-muted",
							children: "One class only: infected, meaning suspected fall armyworm damage on a corn leaf. No boxes does not mean the leaf is healthy."
						})]
					})]
				})
			]
		})]
	});
}
function StatusPill({ status }) {
	const ready = status?.model_ready === true;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: ready ? "inline-flex h-10 items-center self-start rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground lg:self-auto" : "inline-flex h-10 items-center self-start rounded-full border border-line bg-canvas px-4 text-sm font-semibold text-ink lg:self-auto",
		children: !status ? "Checking model" : ready ? "Weights loaded" : "Weights not loaded"
	});
}
function Dropzone({ inputId, dragging, maxBytes, onBrowse, onDragState, onFile }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: dragging ? "flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-primary bg-primary/5 px-6 py-10 text-center" : "flex min-h-80 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-line bg-surface px-6 py-10 text-center",
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
				className: "inline-flex h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90",
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
			className: "border-b border-line px-4 py-3 text-sm font-semibold text-ink",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex items-center justify-center bg-canvas",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src,
				alt,
				className: "max-h-[70vh] w-full object-contain"
			}), scanning ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "pointer-events-none absolute inset-0 overflow-hidden bg-ink/10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "scanline absolute inset-x-0 h-1/3 bg-linear-to-b from-transparent via-primary/40 to-transparent" })
			}) : null]
		})]
	});
}
function SpecPanel({ file, status, running }) {
	const threshold = status?.confidence_threshold == null ? "Not reported" : status.confidence_threshold.toFixed(2);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs font-semibold tracking-widest text-muted uppercase",
					children: running ? "In progress" : "Readout"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-1 truncate font-display text-3xl text-ink",
					title: file?.name || void 0,
					children: file ? file.name : "Waiting for a leaf"
				}),
				file ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-sm text-muted",
					children: [formatBytes(file.size), " · confirm the preview, then detect"]
				}) : null
			] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
				className: "grid grid-cols-2 gap-3 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-canvas px-3 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "Class"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "mt-1 font-semibold text-ink",
						children: status?.class_name || "infected"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "rounded-2xl bg-canvas px-3 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
						className: "text-muted",
						children: "Threshold"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
						className: "mt-1 font-semibold text-ink tabular-nums",
						children: threshold
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-sm leading-relaxed text-pretty text-muted",
				children: [status?.message || "Checking whether the trained weights are available.", " The threshold is a placeholder until validation selects the final cutoff."]
			})
		]
	});
}
function ResultsPanel({ result, onDownload, onReset }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs font-semibold tracking-widest text-muted uppercase",
				children: "Total detections"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-6xl leading-none text-ink tabular-nums",
				children: result.total
			})] }),
			result.total === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-2xl bg-canvas px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-semibold text-ink",
					children: "No suspected FAW damage detected."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm leading-relaxed text-muted",
					children: "The annotated image has no boxes. That is not a health verdict."
				})]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
				className: "flex max-h-80 flex-col gap-2 overflow-auto",
				children: result.detections.map((detection, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "rounded-2xl bg-canvas px-3 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm font-semibold text-ink",
						children: ["Detection ", index + 1]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
						className: "mt-2 grid grid-cols-2 gap-2 text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-muted",
							children: "Class"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "font-medium text-ink",
							children: detection.class
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", {
							className: "text-muted",
							children: "Confidence"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", {
							className: "font-medium text-ink tabular-nums",
							children: formatConfidence(detection.confidence)
						})] })]
					})]
				}, `${detection.bbox.join("-")}-${index}`))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90",
				onClick: onDownload,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, {
					className: "size-4",
					"aria-hidden": "true"
				}), "Download annotated image"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-5 text-sm font-semibold text-ink hover:bg-canvas",
				onClick: onReset,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
					className: "size-4",
					"aria-hidden": "true"
				}), "Detect another image"]
			})
		]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DetectionStudio, {});
}
//#endregion
export { Home as component };
