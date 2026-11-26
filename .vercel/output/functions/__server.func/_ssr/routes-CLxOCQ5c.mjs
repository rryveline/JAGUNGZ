import { i as __toESM } from "../_runtime.mjs";
import { q as require_react, x as require_jsx_runtime, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as Leaf, o as Menu, t as X, u as ArrowRight } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CLxOCQ5c.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var LESSONS = [
	{
		src: "/landing/leaf-healthy.jpg",
		index: "01",
		title: "A whole leaf",
		text: "A healthy corn leaf is one surface, with a pale midrib and parallel veins. Start here, so the marks later are easier to see.",
		alt: "A whole green corn leaf with no holes"
	},
	{
		src: "/landing/leaf-window.jpg",
		index: "02",
		title: "Windowpane feeding",
		text: "Young fall armyworm larvae scrape the leaf instead of biting through it. The patch turns pale and thin, like a window, and the leaf is still in one piece.",
		alt: "A corn leaf with pale scraped windowpane patches"
	},
	{
		src: "/landing/leaf-holes.jpg",
		index: "03",
		title: "Holes come later",
		text: "Older larvae chew through. Edges go ragged and the holes get larger. Dust-like frass in the whorl is another clue. Hail, beetles, and other caterpillars can leave holes too, so a hole is a clue, not a verdict.",
		alt: "A corn leaf with ragged holes along the margin"
	}
];
var TEAM = [
	{
		name: "Newguinea",
		role: "Lead · Evaluation",
		task: "Evaluation tools and final model",
		src: "/landing/team-newguinea.jpg"
	},
	{
		name: "Victoria",
		role: "Data · Baseline",
		task: "Dataset, size profile, E0–E1",
		src: "/landing/team-victoria.jpg"
	},
	{
		name: "Ryveline",
		role: "Resolution · Tiling",
		task: "High-res E2, tiling E3",
		src: "/landing/team-ryveline.jpg"
	},
	{
		name: "Tiara",
		role: "Inference · Errors",
		task: "SAHI E4, augmentation E6, error analysis",
		src: "/landing/team-tiara.jpg"
	},
	{
		name: "Mitchelly",
		role: "Architecture · Deploy",
		task: "P2 head E5, INT8 export E7, demo",
		src: "/landing/team-mitchelly.jpg"
	}
];
var TITLE = "JAGUNGZ";
function useInView(threshold = .25) {
	const ref = (0, import_react.useRef)(null);
	const [shown, setShown] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const node = ref.current;
		if (!node) return;
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			setShown(true);
			return;
		}
		const observer = new IntersectionObserver(([entry]) => {
			if (entry?.isIntersecting) {
				setShown(true);
				observer.disconnect();
			}
		}, { threshold });
		observer.observe(node);
		return () => observer.disconnect();
	}, [threshold]);
	return {
		ref,
		shown
	};
}
function TeamPortrait({ name, src }) {
	const [failed, setFailed] = (0, import_react.useState)(false);
	if (failed) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex size-full items-center justify-center bg-canvas",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "flex size-24 items-center justify-center rounded-full border border-accent font-display text-4xl font-semibold text-accent",
			children: name.charAt(0)
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
		src,
		alt: `Portrait of ${name}`,
		onError: () => setFailed(true),
		className: "size-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
	});
}
function LandingPage() {
	const learn = useInView(.18);
	const about = useInView(.12);
	const [menuOpen, setMenuOpen] = (0, import_react.useState)(false);
	const [showCta, setShowCta] = (0, import_react.useState)(false);
	const [progress, setProgress] = (0, import_react.useState)(0);
	const [activeLesson, setActiveLesson] = (0, import_react.useState)(0);
	const lessonRefs = (0, import_react.useRef)([]);
	const aboutWatch = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		let frame = 0;
		const onScroll = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				const max = document.documentElement.scrollHeight - window.innerHeight;
				setProgress(max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0);
			});
		};
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener("scroll", onScroll);
		};
	}, []);
	(0, import_react.useEffect)(() => {
		const nodes = lessonRefs.current.filter((node) => node !== null);
		if (nodes.length === 0) return;
		const observer = new IntersectionObserver((entries) => {
			const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
			if (!visible) return;
			const index = nodes.indexOf(visible.target);
			if (index >= 0) setActiveLesson(index);
		}, {
			threshold: [.35, .6],
			rootMargin: "-15% 0px -25% 0px"
		});
		nodes.forEach((node) => observer.observe(node));
		return () => observer.disconnect();
	}, []);
	(0, import_react.useEffect)(() => {
		const node = aboutWatch.current;
		if (!node) return;
		const observer = new IntersectionObserver(([entry]) => {
			if (entry?.isIntersecting) setShowCta(true);
		}, { threshold: .15 });
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	function closeMenu() {
		setMenuOpen(false);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen bg-canvas px-3 py-4 sm:px-8 sm:py-10",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "sheet mx-auto max-w-6xl bg-surface",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-20 bg-surface/90 backdrop-blur-md",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "h-px w-full bg-line",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "h-full origin-left bg-accent transition-transform duration-150 ease-out",
								style: { transform: `scaleX(${progress})` }
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-4 px-4 py-3 sm:px-8",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
									href: "#top",
									className: "flex items-center gap-2 text-primary",
									"aria-label": "JAGUNGZ home",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Leaf, {
										className: "size-5",
										"aria-hidden": "true"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-display text-lg font-semibold tracking-wide text-ink",
										children: "JAGUNGZ"
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
									className: "hidden items-center gap-8 text-sm text-muted sm:flex",
									"aria-label": "Page",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
											href: "#top",
											className: "text-ink transition-colors duration-200 hover:text-primary",
											children: "Home"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
											href: "#learn",
											className: "transition-colors duration-200 hover:text-primary",
											children: "Learn"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
											href: "#about",
											className: "transition-colors duration-200 hover:text-primary",
											children: "About us"
										})
									]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/detect",
									className: "hidden text-sm font-medium text-primary transition-colors duration-200 hover:text-ink sm:inline",
									children: "Analyze"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									className: "flex size-11 items-center justify-center text-ink sm:hidden",
									"aria-expanded": menuOpen,
									"aria-controls": "home-menu",
									onClick: () => setMenuOpen((open) => !open),
									children: [menuOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Menu, { className: "size-5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sr-only",
										children: "Menu"
									})]
								})
							]
						}),
						menuOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
							id: "home-menu",
							className: "flex flex-col border-t border-line px-4 py-2 sm:hidden",
							"aria-label": "Page",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "#top",
									className: "px-2 py-3 text-sm",
									onClick: closeMenu,
									children: "Home"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "#learn",
									className: "px-2 py-3 text-sm",
									onClick: closeMenu,
									children: "Learn"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
									href: "#about",
									className: "px-2 py-3 text-sm",
									onClick: closeMenu,
									children: "About us"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/detect",
									className: "px-2 py-3 text-sm text-primary",
									onClick: closeMenu,
									children: "Analyze"
								})
							]
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					id: "top",
					className: "scroll-mt-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "hero-plate overflow-hidden",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
							src: "/landing/hero.jpg",
							alt: "",
							className: "hero-drift h-72 w-full origin-center object-cover object-center sm:h-96"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto flex max-w-xl flex-col items-center px-6 pt-14 pb-16 text-center sm:pt-20 sm:pb-24",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium tracking-widest text-accent uppercase",
								children: "Data Mining and Warehousing - B"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "mt-4 font-display text-6xl leading-none font-semibold text-ink sm:text-8xl",
								children: TITLE.split("").map((letter, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hero-letter",
									style: { animationDelay: `${.15 + index * .07}s` },
									children: letter
								}, `${letter}-${index}`))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "rule-draw mt-6 block h-px w-16 origin-center bg-accent" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-6 max-w-sm text-base leading-relaxed text-pretty text-muted",
								children: "A closer look at suspected fall armyworm damage on corn leaves."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
								href: "#learn",
								className: "group mt-10 inline-flex flex-col items-center gap-3 text-muted",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-medium tracking-widest uppercase transition-colors duration-200 group-hover:text-ink",
									children: "See more"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "relative h-12 w-px overflow-hidden bg-line",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "see-more-drop absolute inset-x-0 top-0 h-4 bg-accent" })
								})]
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					id: "learn",
					ref: learn.ref,
					className: `scroll-mt-20 border-t border-line px-4 py-16 sm:px-10 sm:py-24 ${learn.shown ? "is-in" : ""}`,
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rise mx-auto max-w-2xl text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs font-medium tracking-widest text-accent uppercase",
								children: "What to know"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
								className: "mt-3 font-display text-4xl font-semibold text-balance text-ink sm:text-5xl",
								children: "Why a leaf has holes"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-4 text-base leading-relaxed text-muted",
								children: "Three stages, one leaf. JAGUNGZ marks suspected damage. It does not name the insect."
							})
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "rise mx-auto mt-14 grid max-w-5xl items-start gap-10 lg:mt-20 lg:grid-cols-2 lg:gap-20",
						style: { transitionDelay: "120ms" },
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden lg:sticky lg:top-28 lg:block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "relative aspect-3/2 overflow-hidden bg-canvas",
								children: LESSONS.map((lesson, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
									src: lesson.src,
									alt: index === activeLesson ? lesson.alt : "",
									className: `leaf-shot absolute inset-0 size-full object-cover ${index === activeLesson ? "scale-100 opacity-100 blur-none" : "scale-105 opacity-0 blur-sm"}`
								}, lesson.src))
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-5 flex items-center gap-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-display text-sm text-accent",
										children: LESSONS[activeLesson].index
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "relative h-px flex-1 bg-line",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "absolute inset-0 origin-left bg-accent transition-transform duration-700 ease-out",
											style: { transform: `scaleX(${(activeLesson + 1) / LESSONS.length})` }
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-xs tracking-widest text-muted uppercase",
										children: LESSONS[activeLesson].title
									})
								]
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
							className: "flex flex-col",
							children: LESSONS.map((lesson, index) => {
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
									ref: (node) => {
										lessonRefs.current[index] = node;
									},
									className: "flex flex-col justify-center border-t border-line py-12 first:border-t-0 lg:min-h-[80vh] lg:py-16",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
										className: `step-copy ${index === activeLesson ? "lg:translate-y-0 lg:opacity-100" : "lg:translate-y-3 lg:opacity-45"}`,
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
												src: lesson.src,
												alt: lesson.alt,
												className: "mb-6 aspect-3/2 w-full object-cover lg:hidden"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "font-display text-sm text-accent",
												children: lesson.index
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
												className: "mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl",
												children: lesson.title
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
												className: "mt-4 max-w-md text-base leading-relaxed text-muted",
												children: lesson.text
											})
										]
									})
								}, lesson.title);
							})
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					id: "about",
					ref: (node) => {
						about.ref.current = node;
						aboutWatch.current = node;
					},
					className: `scroll-mt-20 border-t border-line px-4 py-20 sm:px-10 sm:py-28 ${about.shown ? "is-in" : ""}`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rise text-center",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-xs font-medium tracking-widest text-ink uppercase",
									children: "About us"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mx-auto mt-4 block h-px w-12 bg-ink" }),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
									className: "mt-5 font-display text-4xl font-semibold text-ink sm:text-5xl",
									children: "Five people, one detector"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 lg:grid-cols-5",
							children: TEAM.map((person, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
								className: "portrait-reveal",
								style: { transitionDelay: `${index * 90}ms` },
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
									className: "group text-center",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "relative mx-auto aspect-2/3 w-full max-w-48 overflow-hidden",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TeamPortrait, {
												name: person.name,
												src: person.src
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pointer-events-none absolute inset-0 bg-accent opacity-0 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-100" })]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
											className: "mt-5 font-display text-lg font-semibold text-ink",
											children: person.name
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-1 text-xs font-semibold tracking-widest text-accent uppercase",
											children: person.role
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "name-rule mx-auto mt-2 block h-px w-8 bg-accent" }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											className: "mt-2 text-sm text-muted",
											children: person.task
										})
									]
								})
							}, person.name))
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "rise mt-16 text-center",
							style: { transitionDelay: "420ms" },
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/detect",
								className: "group inline-flex items-center gap-3 rounded-full bg-primary py-3 pr-4 pl-6 text-sm font-medium text-primary-foreground transition-transform duration-150 ease-out active:scale-[0.96]",
								children: ["Start upload", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, {
									className: "size-4 transition-transform duration-300 ease-out group-hover:translate-x-1",
									"aria-hidden": "true"
								})]
							})
						})
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: "/detect",
			className: `cta-pop group fixed right-4 bottom-4 z-30 inline-flex items-center gap-3 rounded-full bg-primary py-3 pr-4 pl-5 text-sm font-medium text-primary-foreground shadow-lg transition-transform duration-150 ease-out active:scale-[0.96] sm:right-8 sm:bottom-8 ${showCta ? "is-in" : "pointer-events-none"}`,
			tabIndex: showCta ? 0 : -1,
			"aria-hidden": showCta ? void 0 : true,
			children: ["Start upload", /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, {
				className: "size-4 transition-transform duration-300 ease-out group-hover:translate-x-1",
				"aria-hidden": "true"
			})]
		})]
	});
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LandingPage, {});
}
//#endregion
export { Home as component };
