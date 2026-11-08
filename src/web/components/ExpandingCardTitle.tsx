import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useSettings } from "../hooks/useSettings";

// ─── ExpandingCardTitle — the 60fps Expanding Title Hover engine ──────────
//
// WHY THIS EXISTS (root causes the naive approach died of):
//
//  1. `max-height` transitions lie. Animating max-height 1.35rem → 5.6rem
//     (90px) when a 2-line title is only ~35px tall means the transition
//     curve spends its early frames covering the invisible 35→90px zone:
//     the visible motion starts late on hover-in (hard ceiling hit early is
//     the reverse problem on hover-out — a ~200ms dead delay while
//     max-height counts down 90→35px with nothing visibly changing).
//
//  2. Growing the title box in normal flow stretches the whole CSS grid row
//     on hover, pushing every card in the rows below down the page.
//
// THE FIX (v6 — WHOLE-COMPONENT STRETCH):
//
//  A. EXACT PIXEL HEIGHT MEASUREMENT — a hidden pre-wrapped measurement
//     span (`.anime-card-title-measure`) records the true multi-line pixel
//     height of the title via ResizeObserver + useLayoutEffect, exposed as
//     `--title-full-h` (e.g. 35px); the 1-line height is recorded as
//     `--title-rest-h` (one line-height). data-multiline="true" is set only
//     when the title actually wraps — single-line titles stay 100% static.
//
//  B. ONE ELEMENT STRETCHES TO FIT THE NAME — the single visible title
//     text lives inside `.anime-card-title-clip` (overflow:hidden). At
//     rest the clip is exactly one line tall and the text is clamped to
//     1 line. On hover the clamp is dropped (text reflows to its natural
//     multi-line layout) and the clip animates its height
//     rest-h → full-h over 0.3s ease-in-out — the box itself stretches
//     open to fit the complete name. No crossfade, no dual layers, no
//     duplicate text: the component IS the thing that grows, and the
//     transition curve is spent ENTIRELY on visible motion.
//
//  C. BOTTOM-ANCHORED EXPANSION (zero grid reflow) — the parent card
//     reserves a fixed-height flow spacer (h-[56px] md:h-[60px]) and the
//     title container is position:absolute bottom:0 inside the card frame,
//     so the stretching title grows UPWARD over the poster artwork. Grid
//     rows below never move.
//
// The hover behavior is pure CSS keyed on data-multiline — see the
// .anime-card-title-container blocks in index.css.
//
// PERF CONTRACT (v6): the container carries `transition: all 0.3s
// ease-in-out` + `will-change: transform`; the clip owns a real height
// transition and the text uses a real -webkit-line-clamp at rest, dropped
// on hover; every hover-driven rule is scoped inside
// @media (hover: hover) and (pointer: fine) so touch devices skip the
// hover animations entirely.

interface Props {
  title: string;
  /** Small meta row rendered under the title (score · status · year / EP). */
  meta?: ReactNode;
  /** White text + drop shadow for titles laid over poster artwork. */
  onArtwork?: boolean;
  className?: string;
}

/** Typography shared by the measure span and the visible text — the hidden
 *  measurement MUST render with the exact same font/line-height as the real
 *  title or --title-full-h / --title-rest-h measure the wrong heights. */
const TEXT_CLS = "text-[13px] font-bold leading-snug tracking-tight";

export function ExpandingCardTitle({ title, meta, onArtwork, className = "" }: Props) {
  const [settings] = useSettings();
  const hoverEnabled = settings.expandingTitleHover;

  const measureRef = useRef<HTMLSpanElement>(null);
  const [fullH, setFullH] = useState(0);
  const [restH, setRestH] = useState(0);
  const [multiline, setMultiline] = useState(false);

  // (A) Exact height measurement. The measure span is absolutely
  //     positioned left-0 right-0 inside the title container, so its width
  //     tracks the container exactly like the visible text — a
  //     ResizeObserver on it re-measures on card resize (grid columns,
  //     breakpoint flips) with zero layout thrash.
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 18;
      setFullH(Math.round(h * 100) / 100);
      setRestH(Math.round(lh * 100) / 100);
      setMultiline(h > lh * 1.6);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [title]);

  // Setting disabled → render the static legacy title (1-line truncate).
  if (!hoverEnabled) {
    return (
      <div className={`min-w-0 ${onArtwork ? "anime-card-title-onartwork" : ""} ${className}`}>
        <span className="block truncate text-[13px] font-bold leading-snug tracking-tight text-foreground">
          {title}
        </span>
        {meta}
      </div>
    );
  }

  return (
    <div
      className={`anime-card-title-container group/xantitle relative ${onArtwork ? "anime-card-title-onartwork" : ""} ${className}`}
      data-multiline={multiline ? "true" : "false"}
      style={{ "--title-full-h": `${fullH}px`, "--title-rest-h": `${restH}px` } as CSSProperties}
    >
      {/* Hidden measurement span — pre-wrapped (never clamped), invisible,
          out of a11y tree. Shares .anime-card-title-text typography so the
          measurement matches the visible text exactly. */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className={`anime-card-title-measure anime-card-title-text absolute left-0 right-0 top-0 invisible pointer-events-none select-none ${TEXT_CLS}`}
      >
        {title}
      </span>

      {/* The stretching box — ONE title text, ONE height animation.
          rest: 1 line tall (clamp on) → hover: full name (clamp unset,
          height grows to --title-full-h). Meta follows below in flow. */}
      <div className="anime-card-title-clip">
        <span className={`anime-card-title-text ${TEXT_CLS}`}>
          {title}
        </span>
      </div>

      {meta && <div className="anime-card-title-meta">{meta}</div>}
    </div>
  );
}
