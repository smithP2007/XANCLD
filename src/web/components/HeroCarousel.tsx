import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Info, Star, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { AnimeCard } from "../lib/anilist";
import { getTitle } from "../lib/anilist";

interface Props {
  anime: AnimeCard[];
  onActiveChange?: (color: string | null) => void;
}

const SLIDE_MS = 7000;

function sanitizeDescription(d: string | null | undefined): string {
  if (!d) return "";
  return d.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, "").trim();
}

// v4 ROSA: the hero was REPOSITIONED from a full-bleed 88vh backdrop with
// bottom-left info into a CONTAINED rounded card (inset from the page edges).
// Info is now vertically centered on the LEFT, the poster stands as a
// floating rounded card on the RIGHT, nav arrows moved to a bottom-right
// cluster, and progress segments sit bottom-left. Buttons are pills.
// v4.2.4 (user request: "make hero banner in home page smaller"): card
// height reduced 72vh→56vh desktop (max 700→560px) and 64vh→52vh mobile —
// a compact banner that lets the rows below breathe above the fold.
// v4.2.4b (user request: "width smaller of hero banner and with proper
// alignment"): the section now sits in the SAME max-w-7xl centered container
// as every row below it, with identical horizontal padding — the hero was
// previously uncapped (full content width, visibly wider than the rows on
// large screens). Card edges now align exactly with the content grid, and
// the banner is narrower on wide displays.
export function HeroCarousel({ anime, onActiveChange }: Props) {
  const [active, setActive] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const slides = anime.slice(0, 5);
  const paused = hoverPaused;

  const go = useCallback(
    (dir: 1 | -1) => setActive((i) => (i + dir + slides.length) % slides.length),
    [slides.length],
  );
  const goTo = useCallback(
    (i: number) => setActive(((i % slides.length) + slides.length) % slides.length),
    [slides.length],
  );

  // Sync ambient color
  useEffect(() => {
    onActiveChange?.(slides[active]?.coverImage?.color ?? null);
  }, [active, slides, onActiveChange]);

  // Auto-rotate (paused on hover OR when user has explicitly paused)
  useEffect(() => {
    if (paused || slides.length <= 1) return;
    timerRef.current = setTimeout(() => go(1), SLIDE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [active, paused, go, slides.length]);

  if (slides.length === 0) return null;

  const current = slides[active];
  const title = getTitle(current.title);
  const synopsis = sanitizeDescription(current.description);
  const banner =
    current.bannerImage ||
    current.coverImage?.extraLarge ||
    current.coverImage?.large ||
    "/placeholder.svg";
  const poster = current.coverImage?.extraLarge || current.coverImage?.large || "/placeholder.svg";

  // Meta as pill chips (new form — was hairline text row)
  const metaChips = (
    <div className="flex flex-wrap items-center gap-2">
      {current.averageScore != null && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-bold text-white">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {current.averageScore}%
        </span>
      )}
      {current.seasonYear && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-bold text-white/80">
          <Calendar className="h-3 w-3" />
          {current.season
            ? `${current.season.charAt(0)}${current.season.slice(1).toLowerCase()} ${current.seasonYear}`
            : current.seasonYear}
        </span>
      )}
      {current.episodes != null && (
        <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-bold text-white/80">
          {current.episodes} eps
        </span>
      )}
      {current.format && (
        <span className="rounded-full border border-xan-crimson/40 bg-xan-crimson/15 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-xan-crimson">
          {current.format}
        </span>
      )}
    </div>
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        to={`/watch/${current.id}?ep=1`}
        className="btn-aurora inline-flex h-11 items-center gap-2 px-7 text-[15px] font-bold"
      >
        <Play className="h-4.5 w-4.5 fill-white" />
        Play
      </Link>
      <Link
        to={`/anime/${current.id}`}
        className="glass inline-flex h-11 items-center gap-2 rounded-full px-6 text-[15px] font-bold text-white transition-colors hover:bg-white/10"
      >
        <Info className="h-4.5 w-4.5" />
        Details
      </Link>
    </div>
  );

  return (
    <section
      className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6 md:pt-6"
      aria-roledescription="carousel"
      aria-label="Featured anime"
    >
      <div
        className="relative h-[52vh] min-h-[380px] overflow-hidden rounded-[24px] border border-xan-border md:h-[56vh] md:max-h-[560px] md:min-h-[430px] md:rounded-[32px]"
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
      >
        {/* Backdrop art — slow Ken Burns */}
        <div key={current.id} className="absolute inset-0">
          <img
            src={banner}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover animate-ken-burns"
          />
          {/* Sharper poster fallback on mobile where banners can crop badly */}
          <img
            src={poster}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full object-cover animate-ken-burns md:hidden"
            style={{ objectPosition: "center 22%" }}
          />
        </div>

        {/* Scrims — left fade for text + soft bottom settle */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/20" />

        {/* ─── DESKTOP — info vertically centered left, poster right ─── */}
        <div className="relative hidden h-full md:block">
          <div
            key={`d-${current.id}`}
            className="absolute inset-0 flex items-center px-10 lg:px-14 xl:px-16 animate-hero-info"
          >
            <div className="max-w-xl space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-xan-crimson/40 bg-xan-crimson/15 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-xan-crimson">
                <Play className="h-3 w-3 fill-xan-crimson" />
                #{active + 1} Trending Now
              </span>

              {/* h2 not h1 — the page's single h1 is the HomeGreeting heading;
                  this is a per-slide content title and changes every 7s */}
              <h2 className="break-words font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.02em] text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.65)] lg:text-5xl xl:text-[3.4rem]">
                {title}
              </h2>

              {metaChips}

              {current.genres && current.genres.length > 0 && (
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">
                  {current.genres.slice(0, 4).join(" · ")}
                </p>
              )}

              {synopsis && (
                <p className="max-w-lg text-sm leading-relaxed text-white/70 line-clamp-2 lg:text-[15px]">
                  {synopsis}
                </p>
              )}

              <div className="pt-1.5">{actionButtons}</div>
            </div>
          </div>

          {/* Floating poster card on the RIGHT (new position) */}
          <div
            key={`p-${current.id}`}
            className="absolute right-10 top-1/2 hidden w-[200px] -translate-y-1/2 xl:block animate-hero-info"
          >
            <div className="overflow-hidden rounded-3xl border border-white/15 shadow-[0_32px_70px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
              <img src={poster} alt="" aria-hidden className="aspect-[2/3] w-full object-cover" />
            </div>
            {/* Glow bed under the poster */}
            <div className="mx-auto mt-3 h-6 w-3/4 rounded-full bg-black/50 blur-xl" />
          </div>
        </div>

        {/* ─── MOBILE — info stack at the bottom of the card ─── */}
        <div
          key={`m-${current.id}`}
          className="relative flex h-full flex-col justify-end px-5 pb-14 animate-hero-info md:hidden"
        >
          <span className="mb-2.5 inline-flex w-fit items-center gap-1.5 rounded-full border border-xan-crimson/40 bg-xan-crimson/15 px-3 py-1 text-[9px] font-extrabold uppercase tracking-[0.2em] text-xan-crimson">
            #{active + 1} Trending
          </span>
          <h2 className="line-clamp-2 font-display text-[26px] font-extrabold leading-[1.06] tracking-[-0.02em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            {title}
          </h2>

          <div className="mt-3">{metaChips}</div>

          {current.genres && current.genres.length > 0 && (
            <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white/55">
              {current.genres.slice(0, 3).join(" · ")}
            </p>
          )}

          <div className="mt-4">{actionButtons}</div>
        </div>

        {/* Progress segments — bottom-left inside the card (repositioned).
            v4.3 LIVELY: the active segment fills w-4→w-9 over exactly the
            7s auto-advance window (animation restarts each slide change and
            while unpaused — the timer resets on the same triggers, so they
            stay in sync). Paused: static full bar reads as "held". */}
        <div className="absolute bottom-6 left-6 z-20 flex items-center gap-1.5 md:bottom-7 md:left-8">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === active
                  ? `w-9 bg-gradient-to-r from-xan-crimson to-xan-violet ${!paused && slides.length > 1 ? "animate-seg-fill" : ""}`
                  : "w-4 bg-white/25 hover:bg-white/50"
              }`}
            />
          ))}
        </div>

        {/* Arrow cluster — bottom-right inside the card (repositioned) */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 md:bottom-6 md:right-6">
          <button
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next slide"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/45 text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </section>
  );
}
