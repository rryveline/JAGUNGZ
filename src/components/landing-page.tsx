import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Leaf, Menu, X } from "lucide-react";

const LESSONS = [
  {
    src: "/landing/leaf-healthy.jpg",
    index: "01",
    title: "A whole leaf",
    text: "A healthy corn leaf is one surface, with a pale midrib and parallel veins. Start here, so the marks later are easier to see.",
    alt: "A whole green corn leaf with no holes",
  },
  {
    src: "/landing/leaf-window.jpg",
    index: "02",
    title: "Windowpane feeding",
    text: "Young fall armyworm larvae scrape the leaf instead of biting through it. The patch turns pale and thin, like a window, and the leaf is still in one piece.",
    alt: "A corn leaf with pale scraped windowpane patches",
  },
  {
    src: "/landing/leaf-holes.jpg",
    index: "03",
    title: "Holes come later",
    text: "Older larvae chew through. Edges go ragged and the holes get larger. Dust-like frass in the whorl is another clue. Hail, beetles, and other caterpillars can leave holes too, so a hole is a clue, not a verdict.",
    alt: "A corn leaf with ragged holes along the margin",
  },
] as const;

const TEAM = [
  { name: "Model", role: "Trains the detector", src: "/landing/person-1.jpg" },
  { name: "Data", role: "Labels the leaves", src: "/landing/person-2.jpg" },
  { name: "Interface", role: "Builds this site", src: "/landing/person-3.jpg" },
  { name: "Evaluation", role: "Checks the results", src: "/landing/person-4.jpg" },
  { name: "Report", role: "Writes the notes", src: "/landing/person-5.jpg" },
] as const;

const TITLE = "JAGUNGZ";

function useInView<T extends HTMLElement>(threshold = 0.25) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, shown };
}

export function LandingPage() {
  const learn = useInView<HTMLElement>(0.18);
  const about = useInView<HTMLElement>(0.12);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeLesson, setActiveLesson] = useState(0);
  const lessonRefs = useRef<Array<HTMLElement | null>>([]);
  const aboutWatch = useRef<HTMLElement>(null);

  useEffect(() => {
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

  useEffect(() => {
    const nodes = lessonRefs.current.filter((node): node is HTMLElement => node !== null);
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = nodes.indexOf(visible.target as HTMLElement);
        if (index >= 0) setActiveLesson(index);
      },
      { threshold: [0.35, 0.6], rootMargin: "-15% 0px -25% 0px" },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = aboutWatch.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setShowCta(true);
      },
      { threshold: 0.15 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="min-h-screen bg-canvas px-3 py-4 sm:px-8 sm:py-10">
      <div className="sheet mx-auto max-w-6xl bg-surface">
        <header className="sticky top-0 z-20 bg-surface/90 backdrop-blur-md">
          <div className="h-px w-full bg-line">
            <div
              className="h-full origin-left bg-accent transition-transform duration-150 ease-out"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-8">
            <a href="#top" className="flex items-center gap-2 text-primary" aria-label="JAGUNGZ home">
              <Leaf className="size-5" aria-hidden="true" />
              <span className="font-display text-lg font-semibold tracking-wide text-ink">JAGUNGZ</span>
            </a>
            <nav className="hidden items-center gap-8 text-sm text-muted sm:flex" aria-label="Page">
              <a href="#top" className="text-ink transition-colors duration-200 hover:text-primary">
                Home
              </a>
              <a href="#learn" className="transition-colors duration-200 hover:text-primary">
                Learn
              </a>
              <a href="#about" className="transition-colors duration-200 hover:text-primary">
                About us
              </a>
            </nav>
            <Link
              to="/detect"
              className="hidden text-sm font-medium text-primary transition-colors duration-200 hover:text-ink sm:inline"
            >
              Analyze
            </Link>
            <button
              type="button"
              className="flex size-11 items-center justify-center text-ink sm:hidden"
              aria-expanded={menuOpen}
              aria-controls="home-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
              <span className="sr-only">Menu</span>
            </button>
          </div>
          {menuOpen ? (
            <nav id="home-menu" className="flex flex-col border-t border-line px-4 py-2 sm:hidden" aria-label="Page">
              <a href="#top" className="px-2 py-3 text-sm" onClick={closeMenu}>
                Home
              </a>
              <a href="#learn" className="px-2 py-3 text-sm" onClick={closeMenu}>
                Learn
              </a>
              <a href="#about" className="px-2 py-3 text-sm" onClick={closeMenu}>
                About us
              </a>
              <Link to="/detect" className="px-2 py-3 text-sm text-primary" onClick={closeMenu}>
                Analyze
              </Link>
            </nav>
          ) : null}
        </header>

        <section id="top" className="scroll-mt-6">
          <div className="hero-plate overflow-hidden">
            <img
              src="/landing/hero.jpg"
              alt=""
              className="hero-drift h-72 w-full origin-center object-cover object-center sm:h-96"
            />
          </div>
          <div className="mx-auto flex max-w-xl flex-col items-center px-6 pt-14 pb-16 text-center sm:pt-20 sm:pb-24">
            <p className="text-xs font-medium tracking-widest text-accent uppercase">Data Mining and Warehousing - B</p>
            <h1 className="mt-4 font-display text-6xl leading-none font-semibold text-ink sm:text-8xl">
              {TITLE.split("").map((letter, index) => (
                <span key={`${letter}-${index}`} className="hero-letter" style={{ animationDelay: `${0.15 + index * 0.07}s` }}>
                  {letter}
                </span>
              ))}
            </h1>
            <span className="rule-draw mt-6 block h-px w-16 origin-center bg-accent" />
            <p className="mt-6 max-w-sm text-base leading-relaxed text-pretty text-muted">
              A closer look at suspected fall armyworm damage on corn leaves.
            </p>
            <a href="#learn" className="group mt-10 inline-flex flex-col items-center gap-3 text-muted">
              <span className="text-xs font-medium tracking-widest uppercase transition-colors duration-200 group-hover:text-ink">
                See more
              </span>
              <span className="relative h-12 w-px overflow-hidden bg-line">
                <span className="see-more-drop absolute inset-x-0 top-0 h-4 bg-accent" />
              </span>
            </a>
          </div>
        </section>

        <section
          id="learn"
          ref={learn.ref}
          className={`scroll-mt-20 border-t border-line px-4 py-16 sm:px-10 sm:py-24 ${learn.shown ? "is-in" : ""}`}
        >
          <div className="rise mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium tracking-widest text-accent uppercase">What to know</p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-balance text-ink sm:text-5xl">Why a leaf has holes</h2>
            <p className="mt-4 text-base leading-relaxed text-muted">
              Three stages, one leaf. JAGUNGZ marks suspected damage. It does not name the insect.
            </p>
          </div>

          <div className="rise mx-auto mt-14 grid max-w-5xl items-start gap-10 lg:mt-20 lg:grid-cols-2 lg:gap-20" style={{ transitionDelay: "120ms" }}>
            <div className="hidden lg:sticky lg:top-28 lg:block">
              <div className="relative aspect-3/2 overflow-hidden bg-canvas">
                {LESSONS.map((lesson, index) => (
                  <img
                    key={lesson.src}
                    src={lesson.src}
                    alt={index === activeLesson ? lesson.alt : ""}
                    className={`leaf-shot absolute inset-0 size-full object-cover ${
                      index === activeLesson ? "scale-100 opacity-100 blur-none" : "scale-105 opacity-0 blur-sm"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-5 flex items-center gap-3">
                <span className="font-display text-sm text-accent">{LESSONS[activeLesson].index}</span>
                <span className="relative h-px flex-1 bg-line">
                  <span
                    className="absolute inset-0 origin-left bg-accent transition-transform duration-700 ease-out"
                    style={{ transform: `scaleX(${(activeLesson + 1) / LESSONS.length})` }}
                  />
                </span>
                <span className="text-xs tracking-widest text-muted uppercase">{LESSONS[activeLesson].title}</span>
              </div>
            </div>

            <ol className="flex flex-col">
              {LESSONS.map((lesson, index) => {
                const active = index === activeLesson;
                return (
                  <li
                    key={lesson.title}
                    ref={(node) => {
                      lessonRefs.current[index] = node;
                    }}
                    className="flex flex-col justify-center border-t border-line py-12 first:border-t-0 lg:min-h-[80vh] lg:py-16"
                  >
                    <article className={`step-copy ${active ? "lg:translate-y-0 lg:opacity-100" : "lg:translate-y-3 lg:opacity-45"}`}>
                      <img
                        src={lesson.src}
                        alt={lesson.alt}
                        className="mb-6 aspect-3/2 w-full object-cover lg:hidden"
                      />
                      <p className="font-display text-sm text-accent">{lesson.index}</p>
                      <h3 className="mt-3 font-display text-3xl font-semibold text-ink sm:text-4xl">{lesson.title}</h3>
                      <p className="mt-4 max-w-md text-base leading-relaxed text-muted">{lesson.text}</p>
                    </article>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section
          id="about"
          ref={(node) => {
            about.ref.current = node;
            aboutWatch.current = node;
          }}
          className={`scroll-mt-20 border-t border-line px-4 py-20 sm:px-10 sm:py-28 ${about.shown ? "is-in" : ""}`}
        >
          <div className="rise text-center">
            <p className="text-xs font-medium tracking-widest text-ink uppercase">About us</p>
            <span className="mx-auto mt-4 block h-px w-12 bg-ink" />
            <h2 className="mt-5 font-display text-4xl font-semibold text-ink sm:text-5xl">Five people, one detector</h2>
          </div>
          <ul className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-x-5 gap-y-12 sm:grid-cols-3 lg:grid-cols-5">
            {TEAM.map((person, index) => (
              <li key={person.name} className="portrait-reveal" style={{ transitionDelay: `${index * 90}ms` }}>
                <article className="group text-center">
                  <div className="relative mx-auto aspect-2/3 w-full max-w-48 overflow-hidden">
                    <img
                      src={person.src}
                      alt=""
                      className="size-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-accent opacity-0 mix-blend-multiply transition-opacity duration-500 group-hover:opacity-100" />
                  </div>
                  <h3 className="mt-5 text-sm font-semibold tracking-widest text-accent uppercase">{person.name}</h3>
                  <span className="name-rule mx-auto mt-2 block h-px w-8 bg-accent" />
                  <p className="mt-2 text-sm text-muted">{person.role}</p>
                </article>
              </li>
            ))}
          </ul>
          <div className="rise mt-16 text-center" style={{ transitionDelay: "420ms" }}>
            <Link
              to="/detect"
              className="group inline-flex items-center gap-3 rounded-full bg-primary py-3 pr-4 pl-6 text-sm font-medium text-primary-foreground transition-transform duration-150 ease-out active:scale-[0.96]"
            >
              Start upload
              <ArrowRight className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      <Link
        to="/detect"
        className={`cta-pop group fixed right-4 bottom-4 z-30 inline-flex items-center gap-3 rounded-full bg-primary py-3 pr-4 pl-5 text-sm font-medium text-primary-foreground shadow-lg transition-transform duration-150 ease-out active:scale-[0.96] sm:right-8 sm:bottom-8 ${showCta ? "is-in" : "pointer-events-none"}`}
        tabIndex={showCta ? 0 : -1}
        aria-hidden={showCta ? undefined : true}
      >
        Start upload
        <ArrowRight className="size-4 transition-transform duration-300 ease-out group-hover:translate-x-1" aria-hidden="true" />
      </Link>
    </div>
  );
}
