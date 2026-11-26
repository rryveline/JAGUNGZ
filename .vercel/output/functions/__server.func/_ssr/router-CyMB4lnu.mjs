import { i as __toESM, n as __exportAll } from "../_runtime.mjs";
import { _ as createFileRoute, b as useRouter, d as Scripts, f as HeadContent, g as lazyRouteComponent, h as Outlet, m as createRouter, q as require_react, v as createRootRoute, x as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as TriangleAlert } from "../_libs/lucide-react.mjs";
import { a as union, i as string, n as number, r as object, t as literal } from "../_libs/zod.mjs";
import { randomUUID } from "node:crypto";
import { extname, join } from "node:path";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
//#region node_modules/.nitro/vite/services/ssr/assets/router-CyMB4lnu.js
var router_CyMB4lnu_exports = /* @__PURE__ */ __exportAll({ getRouter: () => getRouter });
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FALLBACK_MESSAGE = "An unexpected error occurred. Try reloading the page.";
function errorMessage(error) {
	if (error instanceof Error && error.message) return error.message;
	if (typeof error === "string" && error) return error;
	return FALLBACK_MESSAGE;
}
function AppErrorComponent({ error }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-red-500",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TriangleAlert, {
					className: "size-10",
					strokeWidth: 2
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-lg font-semibold",
				children: "Something went wrong"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400",
				children: errorMessage(error)
			})
		]
	});
}
/**
* Path-based preview hosts serve the dev server under `/{port_id}/` and strip
* that prefix before forwarding, so SSR sees `/` while the browser URL keeps the
* prefix. TanStack Start resets `basepath` on hydration, so a `rewrite` keeps
* client routing and generated links aligned with the public URL.
*/
var PATH_BASED_PREVIEW_HOSTS = /* @__PURE__ */ new Set([
	"preview.grok.genai.mil",
	"preview.grok.mil",
	"preview.grokgsac.com"
]);
var PORT_ID_PREFIX = /^\/hds-[a-z0-9]+-\d+-[a-z0-9]+(?=\/|$)/i;
function previewPathPrefix(hostname, pathname) {
	if (!PATH_BASED_PREVIEW_HOSTS.has(hostname.toLowerCase())) return void 0;
	return PORT_ID_PREFIX.exec(pathname)?.[0];
}
function prefixRewrite(prefix) {
	return {
		input: ({ url }) => {
			if (url.pathname === prefix) url.pathname = "/";
			else if (url.pathname.startsWith(`${prefix}/`)) url.pathname = url.pathname.slice(prefix.length);
			return url;
		},
		output: ({ url }) => {
			url.pathname = `${prefix}${url.pathname}`;
			return url;
		}
	};
}
function previewPathRewrite() {
	if (typeof window === "undefined") return void 0;
	const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
	return prefix ? prefixRewrite(prefix) : void 0;
}
/**
* App-wide client provider mounted once near the root (in `src/routes/__root.tsx`):
*
*   <AuthProvider><Outlet /></AuthProvider>
*
* Better Auth's React client (`@/lib/auth/client`) needs NO context provider —
* its `useSession()` works standalone — so this is a passthrough today. It's
* kept as the single, stable mount point for any future client-side providers
* (e.g. a toast or theme provider) without churning the root shell.
*/
function AuthProvider({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_jsx_runtime.Fragment, { children });
}
var CONNECTOR_TOKEN_READY_EVENT = "grok:connector-token-ready";
function isGrokEmbedderOrigin(origin) {
	try {
		const url = new URL(origin);
		if (url.protocol !== "https:" && url.protocol !== "http:") return false;
		const host = url.hostname.toLowerCase();
		if (host === "grok.com" || host.endsWith(".grok.com")) return true;
		if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
		return false;
	} catch {
		return false;
	}
}
function isSandboxPreviewGuestHost(hostname) {
	const host = hostname.toLowerCase();
	return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}
function isRemintPreviewPair(guestHost, parentHost) {
	const guest = guestHost.toLowerCase();
	const parent = parentHost.toLowerCase();
	const i = guest.indexOf(".preview.");
	if (i <= 0) return false;
	const label = guest.slice(0, i);
	const rest = guest.slice(i + 9);
	if (label.includes(".") || !rest.includes(".")) return false;
	return parent === rest || parent === `grok.${rest}`;
}
function resolveParentEmbedderOrigin(parentIsSelf, referrer, ancestorOrigin, guestHostname = "") {
	if (parentIsSelf) return null;
	for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) try {
		const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
		if (url.protocol !== "https:" && url.protocol !== "http:") continue;
		if (isGrokEmbedderOrigin(url.origin)) return url.origin;
		if (isSandboxPreviewGuestHost(guestHostname) || isRemintPreviewPair(guestHostname, url.hostname)) return url.origin;
	} catch {}
	return null;
}
/**
* Guest side of the grok-web ↔ sandbox preview postMessage bridge.
*
* Activates only when this page is framed by an allowlisted Grok embedder.
* Top-level runs (download/export, local `npm run dev`, deployed sites) noop.
*/
var PREVIEW_BRIDGE_CHANNEL = "grok-preview-bridge";
var EnvelopeSchema = object({
	channel: literal(PREVIEW_BRIDGE_CHANNEL),
	version: number().int().positive(),
	type: string().min(1)
});
var HelloSchema = EnvelopeSchema.extend({ type: literal("hello") });
var NavigateSchema = EnvelopeSchema.extend({
	type: literal("navigate"),
	path: string().min(1)
});
var HistorySchema = EnvelopeSchema.extend({
	type: literal("history"),
	delta: union([literal(-1), literal(1)])
});
var ConnectorTokenReadySchema = EnvelopeSchema.extend({ type: literal("connector-token-ready") });
function isSafeBridgePath(path) {
	if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
	try {
		return new URL(path, "https://preview.invalid").origin === "https://preview.invalid";
	} catch {
		return false;
	}
}
/**
* Origin of the Grok embedder framing this page, or null when the page runs
* top-level (download/export, local `npm run dev`, deployed sites) or under a
* non-Grok parent. Client-only; null during SSR.
*/
function resolveCurrentEmbedderOrigin() {
	if (typeof window === "undefined") return null;
	const ancestorOrigin = typeof location.ancestorOrigins !== "undefined" && location.ancestorOrigins.length > 0 ? location.ancestorOrigins[0] : null;
	return resolveParentEmbedderOrigin(window.parent === window, document.referrer, ancestorOrigin, window.location.hostname);
}
/**
* Install host↔guest messaging. Returns a dispose function.
* Noops (returns a no-op dispose) when not embedded under a Grok parent.
*/
function installPreviewHostBridge(options = {}) {
	const parentOrigin = resolveCurrentEmbedderOrigin();
	if (parentOrigin === null) return () => {};
	const ROOT_STATE_KEY = "__grokPreviewBridgeRoot";
	const originalPushState = window.history.pushState.bind(window.history);
	const originalReplaceState = window.history.replaceState.bind(window.history);
	const isAtHistoryRoot = () => {
		const state = window.history.state;
		return Boolean(state && typeof state === "object" && state[ROOT_STATE_KEY] === true);
	};
	try {
		const current = window.history.state;
		if (!(current !== null && typeof current === "object" && Object.prototype.hasOwnProperty.call(current, ROOT_STATE_KEY))) {
			const isRoot = window.history.length <= 1;
			originalReplaceState(current && typeof current === "object" ? {
				...current,
				[ROOT_STATE_KEY]: isRoot
			} : { [ROOT_STATE_KEY]: isRoot }, "", window.location.href);
		}
	} catch {}
	const post = (message) => {
		window.parent.postMessage(message, parentOrigin);
	};
	const reportLocation = () => {
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "location",
			path: window.location.pathname || "/",
			search: window.location.search,
			hash: window.location.hash
		});
	};
	const reportRoutes = () => {
		const paths = options.getRoutePaths?.() ?? [];
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "routes",
			paths
		});
	};
	const defaultNavigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		try {
			const url = new URL(path, window.location.origin);
			if (url.origin !== window.location.origin) return;
			const next = `${url.pathname}${url.search}${url.hash}`;
			window.history.pushState(window.history.state, "", next);
			window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
		} catch {}
	};
	const navigate = (path) => {
		if (!isSafeBridgePath(path)) return;
		if (options.navigate) {
			options.navigate(path);
			return;
		}
		defaultNavigate(path);
	};
	const announce = () => {
		reportLocation();
		reportRoutes();
		post({
			channel: PREVIEW_BRIDGE_CHANNEL,
			version: 1,
			type: "ready"
		});
	};
	const onHello = (data) => {
		if (!HelloSchema.safeParse(data).success) return;
		announce();
	};
	const onNavigate = (data) => {
		const parsed = NavigateSchema.safeParse(data);
		if (!parsed.success) return;
		navigate(parsed.data.path);
		queueMicrotask(reportLocation);
	};
	const onHistory = (data) => {
		const parsed = HistorySchema.safeParse(data);
		if (!parsed.success) return;
		if (parsed.data.delta === -1 && isAtHistoryRoot()) return;
		window.history.go(parsed.data.delta);
	};
	const onConnectorTokenReady = (data) => {
		if (!ConnectorTokenReadySchema.safeParse(data).success) return;
		window.dispatchEvent(new Event(CONNECTOR_TOKEN_READY_EVENT));
	};
	const hostMessageHandlers = /* @__PURE__ */ new Map([
		["hello", onHello],
		["navigate", onNavigate],
		["history", onHistory],
		["connector-token-ready", onConnectorTokenReady]
	]);
	const onMessage = (event) => {
		if (event.source !== window.parent) return;
		if (event.origin !== parentOrigin) return;
		const envelope = EnvelopeSchema.safeParse(event.data);
		if (!envelope.success || envelope.data.version !== 1) return;
		hostMessageHandlers.get(envelope.data.type)?.(event.data);
	};
	const onPopState = () => {
		reportLocation();
	};
	const onHashChange = () => {
		reportLocation();
	};
	window.history.pushState = (data, unused, url) => {
		const next = data && typeof data === "object" ? {
			...data,
			[ROOT_STATE_KEY]: false
		} : data;
		originalPushState(next, unused, url);
		reportLocation();
	};
	window.history.replaceState = (data, unused, url) => {
		const next = isAtHistoryRoot() ? {
			...data && typeof data === "object" ? data : {},
			[ROOT_STATE_KEY]: true
		} : data;
		originalReplaceState(next, unused, url);
		reportLocation();
	};
	window.addEventListener("message", onMessage);
	window.addEventListener("popstate", onPopState);
	window.addEventListener("hashchange", onHashChange);
	announce();
	return () => {
		window.removeEventListener("message", onMessage);
		window.removeEventListener("popstate", onPopState);
		window.removeEventListener("hashchange", onHashChange);
		window.history.pushState = originalPushState;
		window.history.replaceState = originalReplaceState;
	};
}
/** Collect static path patterns from a TanStack route tree (best-effort). */
function collectRoutePathsFromTree(routeTree) {
	const paths = /* @__PURE__ */ new Set();
	const walk = (node) => {
		if (!node || typeof node !== "object") return;
		const record = node;
		const full = typeof record.fullPath === "string" ? record.fullPath : typeof record.path === "string" ? record.path : null;
		if (full !== null && full !== "") paths.add(full.startsWith("/") ? full : `/${full}`);
		else if (full === "") paths.add("/");
		const children = record.children;
		if (Array.isArray(children)) for (const child of children) walk(child);
		else if (children && typeof children === "object") for (const child of Object.values(children)) walk(child);
	};
	walk(routeTree);
	return [...paths];
}
/**
* Mount once in `__root.tsx` so the Grok preview chrome can drive navigation
* (and later receive registered routes). Noops when the app is not embedded.
*/
function PreviewHostBridge() {
	const router = useRouter();
	(0, import_react.useEffect)(() => {
		return installPreviewHostBridge({
			navigate: (path) => {
				router.history.push(path);
			},
			getRoutePaths: () => collectRoutePathsFromTree(router.routeTree)
		});
	}, [router]);
	return null;
}
var styles_default = "/assets/styles-7v9afBDb.css";
var APP_NAME = "JAGUNGZ";
var Route$11 = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1"
			},
			{ title: APP_NAME },
			{
				name: "description",
				content: "Detect suspected Fall Armyworm damage on corn leaves using computer vision."
			},
			{
				name: "theme-color",
				content: "#245C3A"
			}
		],
		links: [
			{
				rel: "icon",
				type: "image/svg+xml",
				href: "/favicon.svg"
			},
			{
				rel: "stylesheet",
				href: styles_default
			},
			{
				rel: "preconnect",
				href: "https://fonts.googleapis.com"
			},
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous"
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,560;9..144,650&family=Outfit:wght@400;500;600&display=swap"
			},
			{
				rel: "manifest",
				href: "/__grok/manifest.webmanifest"
			},
			{
				rel: "apple-touch-icon",
				href: "/__grok/icon-180.png"
			}
		]
	}),
	component: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("html", {
		lang: "en",
		suppressHydrationWarning: true,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("head", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeadContent, {}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("body", {
			className: "min-h-screen bg-canvas font-sans text-ink antialiased",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewHostBridge, {}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthProvider, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scripts, {})
			]
		})]
	})
});
var $$splitComponentImporter$1 = () => import("./routes-CLxOCQ5c.mjs");
var Route$10 = createFileRoute("/")({ component: lazyRouteComponent($$splitComponentImporter$1, "component") });
var $$splitComponentImporter = () => import("./detect-DWiJ70u1.mjs");
var Route$9 = createFileRoute("/detect")({ component: lazyRouteComponent($$splitComponentImporter, "component") });
var OFFLINE_STATUS = {
	service: "unavailable",
	model_ready: false,
	class_name: "infected",
	confidence_threshold: null,
	iou_threshold: null,
	max_upload_bytes: 10485760,
	weights_hint: "backend/models/best.pt",
	message: "The YOLO26 inference runtime is unavailable. Detections are reported only from your trained model — sample boxes are not substituted."
};
function runCli(args, timeoutMs) {
	return new Promise((resolve, reject) => {
		const projectRoot = process.cwd();
		const pythonBin = process.env.PYTHON_BIN || join(projectRoot, ".venv", "bin", "python");
		const child = spawn(pythonBin, [
			"-m",
			"backend.cli",
			...args
		], {
			cwd: projectRoot,
			env: {
				...process.env,
				PYTHONPATH: projectRoot
			}
		});
		let stdout = "";
		const timer = setTimeout(() => {
			child.kill("SIGKILL");
			const error = /* @__PURE__ */ new Error("timeout");
			error.name = "TimeoutError";
			reject(error);
		}, timeoutMs);
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk) => {
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
				stdout
			});
		});
	});
}
function parsePayload(stdout) {
	const line = stdout.split("\n").map((item) => item.trim()).filter(Boolean).at(-1);
	if (!line) return null;
	try {
		const payload = JSON.parse(line);
		return payload && typeof payload === "object" ? payload : null;
	} catch {
		return null;
	}
}
async function proxyStatus() {
	try {
		const payload = parsePayload((await runCli(["status"], 8e3)).stdout);
		if (!payload) return Response.json(OFFLINE_STATUS);
		return Response.json(payload);
	} catch {
		return Response.json(OFFLINE_STATUS);
	}
}
var MIN_CONFIDENCE_THRESHOLD = .05;
var MAX_CONFIDENCE_THRESHOLD = .9;
var DEFAULT_CONFIDENCE_THRESHOLD = .2;
function parseConfidenceThreshold(raw) {
	if (raw === null) return { value: DEFAULT_CONFIDENCE_THRESHOLD };
	if (typeof raw !== "string") return { error: "Confidence threshold must be a number between 0.05 and 0.90." };
	const trimmed = raw.trim();
	if (!trimmed) return { value: DEFAULT_CONFIDENCE_THRESHOLD };
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < .049999999 || parsed > .900000001) return { error: "Confidence threshold must be between 0.05 and 0.90." };
	return { value: Number(Math.min(MAX_CONFIDENCE_THRESHOLD, Math.max(MIN_CONFIDENCE_THRESHOLD, parsed)).toFixed(4)) };
}
async function proxyDetect(request) {
	let incoming;
	try {
		incoming = await request.formData();
	} catch {
		return Response.json({
			success: false,
			message: "No file is selected."
		}, { status: 400 });
	}
	const thresholdResult = parseConfidenceThreshold(incoming.get("confidence_threshold"));
	if ("error" in thresholdResult) return Response.json({
		success: false,
		message: thresholdResult.error
	}, { status: 400 });
	const modelMode = incoming.get("model_mode") === "e2" ? "e2" : "e3";
	const file = incoming.get("file");
	if (!(file instanceof File)) return Response.json({
		success: false,
		message: "No file is selected."
	}, { status: 400 });
	if (file.size === 0) return Response.json({
		success: false,
		message: "The file is corrupted or cannot be read."
	}, { status: 400 });
	if (file.size > 33554432) return Response.json({
		success: false,
		message: "The file exceeds the upload limit."
	}, { status: 413 });
	const extension = file.type === "image/png" || file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
	const path = join(tmpdir(), `faw-${randomUUID()}.${extension}`);
	try {
		await writeFile(path, Buffer.from(await file.arrayBuffer()));
		const payload = parsePayload((await runCli([
			"detect",
			path,
			"--conf",
			String(thresholdResult.value),
			"--model",
			modelMode
		], 12e4)).stdout);
		if (!payload) return Response.json({
			success: false,
			message: "Unable to process the uploaded image."
		}, { status: 502 });
		const status = typeof payload.status === "number" ? payload.status : payload.success ? 200 : 500;
		return Response.json(payload, { status });
	} catch (error) {
		const timedOut = error instanceof Error && error.name === "TimeoutError";
		return Response.json({
			success: false,
			message: timedOut ? "Detection took too long and was stopped. Try a smaller image." : OFFLINE_STATUS.message
		}, { status: timedOut ? 504 : 503 });
	} finally {
		await unlink(path).catch(() => void 0);
	}
}
async function proxyDetectFrame(request) {
	let incoming;
	try {
		incoming = await request.formData();
	} catch {
		return Response.json({
			success: false,
			message: "No frame is selected."
		}, { status: 400 });
	}
	const thresholdResult = parseConfidenceThreshold(incoming.get("confidence_threshold"));
	if ("error" in thresholdResult) return Response.json({
		success: false,
		message: thresholdResult.error
	}, { status: 400 });
	const rawModel = incoming.get("model_mode");
	const modelMode = rawModel === "e2" || rawModel === "compare" ? rawModel : "e3";
	const file = incoming.get("file");
	if (!(file instanceof File)) return Response.json({
		success: false,
		message: "No frame is selected."
	}, { status: 400 });
	if (file.size === 0) return Response.json({
		success: false,
		message: "The frame is empty or cannot be read."
	}, { status: 400 });
	if (file.size > 10485760) return Response.json({
		success: false,
		message: "The frame exceeds the upload limit."
	}, { status: 413 });
	const extension = file.type === "image/png" || file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
	const path = join(tmpdir(), `faw-frame-${randomUUID()}.${extension}`);
	try {
		await writeFile(path, Buffer.from(await file.arrayBuffer()));
		const payload = parsePayload((await runCli([
			"detect-frame",
			path,
			"--conf",
			String(thresholdResult.value),
			"--model",
			modelMode
		], 3e4)).stdout);
		if (!payload) return Response.json({
			success: false,
			message: "Unable to process the camera frame."
		}, { status: 502 });
		const status = typeof payload.status === "number" ? payload.status : payload.success ? 200 : 500;
		return Response.json(payload, { status });
	} catch (error) {
		const timedOut = error instanceof Error && error.name === "TimeoutError";
		return Response.json({
			success: false,
			message: timedOut ? "Frame detection timed out." : OFFLINE_STATUS.message
		}, { status: timedOut ? 504 : 503 });
	} finally {
		await unlink(path).catch(() => void 0);
	}
}
var MAX_VIDEO_BYTES = 52428800;
var ALLOWED_VIDEO_EXTS = /* @__PURE__ */ new Set([
	".mp4",
	".mov",
	".avi",
	".webm"
]);
var JOB_TTL_MS = 9e5;
var videoJobs = /* @__PURE__ */ new Map();
function scheduleJobCleanup(jobId, workDir) {
	setTimeout(() => {
		videoJobs.delete(jobId);
		rm(workDir, {
			recursive: true,
			force: true
		}).catch(() => void 0);
	}, JOB_TTL_MS);
}
function parseSampleInterval(raw) {
	if (raw === null) return { value: .5 };
	if (typeof raw !== "string") return { error: "Sample interval must be a number between 0.2 and 5.0 seconds." };
	const trimmed = raw.trim();
	if (!trimmed) return { value: .5 };
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < .2 || parsed > 5) return { error: "Sample interval must be between 0.2 and 5.0 seconds." };
	return { value: Number(parsed.toFixed(2)) };
}
async function proxyDetectVideoStart(request) {
	let incoming;
	try {
		incoming = await request.formData();
	} catch {
		return Response.json({
			success: false,
			message: "No video file is selected."
		}, { status: 400 });
	}
	const thresholdResult = parseConfidenceThreshold(incoming.get("confidence_threshold"));
	if ("error" in thresholdResult) return Response.json({
		success: false,
		message: thresholdResult.error
	}, { status: 400 });
	const intervalResult = parseSampleInterval(incoming.get("sample_interval_sec"));
	if ("error" in intervalResult) return Response.json({
		success: false,
		message: intervalResult.error
	}, { status: 400 });
	const rawModel = incoming.get("model_mode");
	const modelMode = rawModel === "e2" || rawModel === "compare" ? rawModel : "e3";
	const file = incoming.get("file");
	if (!(file instanceof File) || !file.name) return Response.json({
		success: false,
		message: "No video file is selected."
	}, { status: 400 });
	const ext = extname(file.name).toLowerCase();
	if (!ALLOWED_VIDEO_EXTS.has(ext)) return Response.json({
		success: false,
		message: "Unsupported video format. Upload an MP4, MOV, AVI, or WEBM file."
	}, { status: 400 });
	if (file.size === 0) return Response.json({
		success: false,
		message: "The video file is corrupted or cannot be read."
	}, { status: 400 });
	if (file.size > MAX_VIDEO_BYTES) return Response.json({
		success: false,
		message: "The video exceeds the upload limit of 50 MB."
	}, { status: 413 });
	const jobId = randomUUID().replaceAll("-", "");
	const workDir = join(tmpdir(), `jagungz-vid-${jobId}`);
	const inputPath = join(workDir, `upload${ext}`);
	try {
		await mkdir(workDir, { recursive: true });
		await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));
	} catch {
		await rm(workDir, {
			recursive: true,
			force: true
		}).catch(() => void 0);
		return Response.json({
			success: false,
			message: "Unable to store uploaded video for analysis."
		}, { status: 500 });
	}
	const job = {
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
		result: null
	};
	videoJobs.set(jobId, job);
	scheduleJobCleanup(jobId, workDir);
	const projectRoot = process.cwd();
	const pythonBin = process.env.PYTHON_BIN || join(projectRoot, ".venv", "bin", "python");
	const child = spawn(pythonBin, [
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
		modelMode
	], {
		cwd: projectRoot,
		env: {
			...process.env,
			PYTHONPATH: projectRoot
		}
	});
	let buffer = "";
	const timer = setTimeout(() => {
		child.kill("SIGKILL");
		job.status = "failed";
		job.message = "Video analysis timed out. Try a shorter video or larger sample interval.";
	}, 3e5);
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk) => {
		buffer += chunk;
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const rawLine of lines) {
			const trimmed = rawLine.trim();
			if (!trimmed) continue;
			try {
				const msg = JSON.parse(trimmed);
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
			} catch {}
		}
	});
	child.on("error", () => {
		clearTimeout(timer);
		job.status = "failed";
		job.message = OFFLINE_STATUS.message;
		unlink(inputPath).catch(() => void 0);
	});
	child.on("close", () => {
		clearTimeout(timer);
		if (job.status === "queued" || job.status === "processing") {
			job.status = "failed";
			job.message = "Video analysis stopped unexpectedly.";
		}
		unlink(inputPath).catch(() => void 0);
	});
	return Response.json({
		success: true,
		job_id: jobId,
		status: "queued"
	}, { status: 202 });
}
async function proxyVideoJobStatus(jobId, request) {
	const job = videoJobs.get(jobId);
	if (!job) return Response.json({
		success: false,
		message: "Video analysis job not found."
	}, { status: 404 });
	if ((request.headers.get("accept") ?? "").includes("text/event-stream")) {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({ start(controller) {
			let closed = false;
			const send = () => {
				if (closed) return;
				const current = videoJobs.get(jobId);
				if (!current) {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({
						success: false,
						status: "failed",
						message: "Job expired."
					})}\n\n`));
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
					message: current.message
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
		} });
		return new Response(stream, { headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive"
		} });
	}
	return Response.json({
		success: true,
		job_id: job.jobId,
		status: job.status,
		percent: job.percent,
		processed_frames: job.processedFrames,
		total_frames: job.totalFrames,
		detections_so_far: job.detectionsSoFar,
		message: job.message
	});
}
async function proxyVideoJobResult(jobId) {
	const job = videoJobs.get(jobId);
	if (!job) return Response.json({
		success: false,
		message: "Video analysis job not found."
	}, { status: 404 });
	if (job.status === "failed") return Response.json({
		success: false,
		message: job.message
	}, { status: 422 });
	if (job.status !== "completed" || !job.result) return Response.json({
		success: false,
		message: "Video analysis is still in progress."
	}, { status: 409 });
	return Response.json({
		success: true,
		job_id: job.jobId,
		video_url: `/api/detect/video/${job.jobId}/download`,
		...job.result
	});
}
async function proxyModelsStatus() {
	try {
		const payload = parsePayload((await runCli(["models-status"], 12e3)).stdout);
		if (!payload) return Response.json({
			success: false,
			message: OFFLINE_STATUS.message
		}, { status: 503 });
		return Response.json(payload);
	} catch {
		return Response.json({
			success: false,
			message: OFFLINE_STATUS.message
		}, { status: 503 });
	}
}
async function proxyCompare(request) {
	let incoming;
	try {
		incoming = await request.formData();
	} catch {
		return Response.json({
			success: false,
			message: "No file is selected."
		}, { status: 400 });
	}
	const thresholdResult = parseConfidenceThreshold(incoming.get("confidence_threshold"));
	if ("error" in thresholdResult) return Response.json({
		success: false,
		message: thresholdResult.error
	}, { status: 400 });
	const file = incoming.get("file");
	if (!(file instanceof File)) return Response.json({
		success: false,
		message: "No file is selected."
	}, { status: 400 });
	if (file.size === 0) return Response.json({
		success: false,
		message: "The file is corrupted or cannot be read."
	}, { status: 400 });
	if (file.size > 33554432) return Response.json({
		success: false,
		message: "The file exceeds the upload limit."
	}, { status: 413 });
	const extension = file.type === "image/png" || file.name.toLowerCase().endsWith(".png") ? "png" : "jpg";
	const path = join(tmpdir(), `faw-cmp-${randomUUID()}.${extension}`);
	try {
		await writeFile(path, Buffer.from(await file.arrayBuffer()));
		const payload = parsePayload((await runCli([
			"compare",
			path,
			"--conf",
			String(thresholdResult.value)
		], 12e4)).stdout);
		if (!payload) return Response.json({
			success: false,
			message: "Unable to compare models on the uploaded image."
		}, { status: 502 });
		const status = typeof payload.status === "number" ? payload.status : payload.success ? 200 : 500;
		return Response.json(payload, { status });
	} catch (error) {
		const timedOut = error instanceof Error && error.name === "TimeoutError";
		return Response.json({
			success: false,
			message: timedOut ? "Model comparison timed out. Try a smaller image." : OFFLINE_STATUS.message
		}, { status: timedOut ? 504 : 503 });
	} finally {
		await unlink(path).catch(() => void 0);
	}
}
async function proxyVideoDownload(jobId, request) {
	const job = videoJobs.get(jobId);
	if (!job || job.status !== "completed" || !job.outputPath) return Response.json({
		success: false,
		message: "Annotated video is not available."
	}, { status: 404 });
	try {
		const data = await readFile(job.outputPath);
		const inline = new URL(request.url).searchParams.get("inline") === "1";
		return new Response(data, {
			status: 200,
			headers: {
				"Content-Type": job.outputMime,
				"Content-Disposition": inline ? `inline; filename="${job.outputFilename}"` : `attachment; filename="${job.outputFilename}"`,
				"Cache-Control": "no-store"
			}
		});
	} catch {
		return Response.json({
			success: false,
			message: "Annotated video is no longer available."
		}, { status: 404 });
	}
}
var Route$8 = createFileRoute("/api/detect")({ server: { handlers: { POST: async ({ request }) => proxyDetect(request) } } });
var Route$7 = createFileRoute("/api/status")({ server: { handlers: { GET: async () => proxyStatus() } } });
var Route$6 = createFileRoute("/api/detect/compare")({ server: { handlers: { POST: async ({ request }) => proxyCompare(request) } } });
var Route$5 = createFileRoute("/api/detect/frame")({ server: { handlers: { POST: async ({ request }) => proxyDetectFrame(request) } } });
var Route$4 = createFileRoute("/api/detect/video")({ server: { handlers: { POST: async ({ request }) => proxyDetectVideoStart(request) } } });
var Route$3 = createFileRoute("/api/models/status")({ server: { handlers: { GET: async () => proxyModelsStatus() } } });
var Route$2 = createFileRoute("/api/detect/video/$jobId")({ server: { handlers: { GET: async ({ params, request }) => proxyVideoJobStatus(params.jobId, request) } } });
var Route$1 = createFileRoute("/api/detect/video/$jobId/download")({ server: { handlers: { GET: async ({ params, request }) => proxyVideoDownload(params.jobId, request) } } });
var Route = createFileRoute("/api/detect/video/$jobId/result")({ server: { handlers: { GET: async ({ params }) => proxyVideoJobResult(params.jobId) } } });
var IndexRoute = Route$10.update({
	id: "/",
	path: "/",
	getParentRoute: () => Route$11
});
var DetectRoute = Route$9.update({
	id: "/detect",
	path: "/detect",
	getParentRoute: () => Route$11
});
var ApiDetectRoute = Route$8.update({
	id: "/api/detect",
	path: "/api/detect",
	getParentRoute: () => Route$11
});
var ApiStatusRoute = Route$7.update({
	id: "/api/status",
	path: "/api/status",
	getParentRoute: () => Route$11
});
var ApiDetectCompareRoute = Route$6.update({
	id: "/compare",
	path: "/compare",
	getParentRoute: () => ApiDetectRoute
});
var ApiDetectFrameRoute = Route$5.update({
	id: "/frame",
	path: "/frame",
	getParentRoute: () => ApiDetectRoute
});
var ApiDetectVideoRoute = Route$4.update({
	id: "/video",
	path: "/video",
	getParentRoute: () => ApiDetectRoute
});
var ApiModelsStatusRoute = Route$3.update({
	id: "/api/models/status",
	path: "/api/models/status",
	getParentRoute: () => Route$11
});
var ApiDetectVideoJobIdRoute = Route$2.update({
	id: "/$jobId",
	path: "/$jobId",
	getParentRoute: () => ApiDetectVideoRoute
});
var ApiDetectVideoJobIdRouteChildren = {
	ApiDetectVideoJobIdDownloadRoute: Route$1.update({
		id: "/download",
		path: "/download",
		getParentRoute: () => ApiDetectVideoJobIdRoute
	}),
	ApiDetectVideoJobIdResultRoute: Route.update({
		id: "/result",
		path: "/result",
		getParentRoute: () => ApiDetectVideoJobIdRoute
	})
};
var ApiDetectVideoRouteChildren = { ApiDetectVideoJobIdRoute: ApiDetectVideoJobIdRoute._addFileChildren(ApiDetectVideoJobIdRouteChildren) };
var ApiDetectRouteChildren = {
	ApiDetectCompareRoute,
	ApiDetectFrameRoute,
	ApiDetectVideoRoute: ApiDetectVideoRoute._addFileChildren(ApiDetectVideoRouteChildren)
};
var rootRouteChildren = {
	IndexRoute,
	DetectRoute,
	ApiDetectRoute: ApiDetectRoute._addFileChildren(ApiDetectRouteChildren),
	ApiStatusRoute,
	ApiModelsStatusRoute
};
var routeTree = Route$11._addFileChildren(rootRouteChildren)._addFileTypes();
function getRouter() {
	return createRouter({
		routeTree,
		rewrite: previewPathRewrite(),
		defaultErrorComponent: AppErrorComponent,
		scrollRestoration: true
	});
}
//#endregion
export { getRouter, router_CyMB4lnu_exports as t };
