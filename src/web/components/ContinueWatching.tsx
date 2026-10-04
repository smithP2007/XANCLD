import { useRef } from "react";
import { Link } from "react-router-dom";
import { History, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { useWatchHistory, type HistoryEntry } from "../hooks/useSettings";
import { formatTimeAgo } from "../hooks/useCountdownTick";

interface Grouped {
  animeId: number;
  title: string;
  coverImage: string;
  episodes: HistoryEntry[];
  latest: HistoryEntry;
}

function groupByAnime(history: HistoryEntry[]): Grouped[] {
  const map = new Map<number, Grouped>();
  for (const entry of history) {
    const existing = map.get(entry.animeId);
    if (existing) {
      existing.episodes.push(entry);
      if (entry.updatedAt > existing.latest.updatedAt) {
        existing.latest = entry;
      }
    } else {
      map.set(entry.animeId, {
        animeId: entry.animeId,
        title: entry.title,
        coverImage: entry.coverImage,
        episodes: [entry],
        latest: entry,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.latest.updatedAt - a.latest.updatedAt);
}

function formatProgress(timestamp: number, duration: number): number {
  if (!duration || duration <= 0) return 0;
  return Math.min(100, Math.max(0, (timestamp / duration) * 100));
}

// v4 ROSA: NEW FORM — the progress bar moved to the TOP edge of the card
// and the title/episode info moved BELOW the artwork onto the card surface
// (was overlaid at the bottom of the image).
export function ContinueWatching() {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to history changes (auto-updates when addToHistory is called)
  const history = useWatchHistory();
  const grouped = groupByAnime(history).slice(0, 10);

  if (grouped.length === 0) return null;

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.8, 900);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-foreground md:text-2xl">
            <span className="h-2.5 w-2.5 shrink-0 rotate-45 rounded-[4px] bg-gradient-to-br from-xan-crimson to-xan-violet" />
            Continue Watching
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
            <History className="h-3.5 w-3.5 text-xan-crimson" />
            Pick up where you left off
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollBy("left")}
            aria-label="Scroll left"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-xan-border bg-xan-card transition-colors hover:border-xan-crimson/50 hover:bg-xan-card-hover md:h-9 md:w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollBy("right")}
            aria-label="Scroll right"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-xan-border bg-xan-card transition-colors hover:border-xan-crimson/50 hover:bg-xan-card-hover md:h-9 md:w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* v4.4.1 HOVER-CLIP FIX — same pattern as SectionRow: `overflow-x:
          auto` forces computed `overflow-y: auto`, clipping at the padding
          box. Cards lift -4px on hover (`-translate-y-1`) with ~2px shadow
          bleed above, so the box needs top headroom. `pt-2` provides it,
          `-mt-2` keeps the cards' visual position unchanged (net shift 0). */}
      <div
        ref={scrollRef}
        className="-mt-2 flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pt-2 pb-2 mask-fade-r"
      >
        {grouped.map((entry, idx) => {
          // Real progress from saved timestamp/duration.
          // iframe players don't report progress, but the Watch page's
          // onProgress handler DOES record timestamp+duration to history
          // for the custom (hls/mp4) player, so this is accurate for those.
          const progress = formatProgress(entry.latest.timestamp, entry.latest.duration);
          const epCount = entry.episodes.length;
          return (
            <Link
              key={entry.animeId}
              to={`/watch/${entry.animeId}?ep=${entry.latest.episode}`}
              className="group block w-[220px] flex-shrink-0 snap-start card-enter sm:w-[250px] md:w-[270px]"
              style={{ "--card-index": idx } as React.CSSProperties}
            >
              <div className="overflow-hidden rounded-[18px] border border-xan-border bg-xan-card transition-all duration-300 group-hover:-translate-y-1 group-hover:border-xan-crimson/50 group-hover:shadow-[0_16px_36px_rgba(0,0,0,0.4)]">
                <div className="relative aspect-video overflow-hidden bg-xan-surface">
                  {/* Progress bar at the TOP edge (repositioned) */}
                  <div className="absolute left-0 right-0 top-0 z-10 h-[3px] bg-white/15">
                    <div
                      className="h-full bg-gradient-to-r from-xan-crimson to-xan-violet transition-all"
                      style={{ width: `${progress || 3}%` }}
                    />
                  </div>

                  {/* Poster crop — landscape card */}
                  <img
                    src={entry.coverImage || "/placeholder.svg"}
                    alt={entry.title}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover opacity-90 transition-all duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/placeholder.svg";
                    }}
                  />

                  {epCount > 1 && (
                    <div className="absolute right-2 top-3 rounded-full border border-white/10 bg-black/55 px-2 py-0.5 text-[9px] font-extrabold text-white backdrop-blur">
                      {epCount} EPS
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-gradient-to-br from-xan-crimson to-xan-violet shadow-[0_8px_24px_rgba(233,69,96,0.45)] transition-transform group-hover:scale-100">
                      <Play className="ml-0.5 h-4.5 w-4.5 fill-white text-white" />
                    </div>
                  </div>
                </div>

                {/* Info below the artwork (repositioned) */}
                <div className="p-3">
                  <p className="line-clamp-1 text-[13px] font-bold tracking-tight text-foreground">
                    {entry.title}
                  </p>
                  <div className="mt-0.5 flex items-center justify-between">
                    <p className="text-[11px] font-extrabold text-xan-crimson">
                      EP {entry.latest.episode}
                    </p>
                    <p className="text-[10px] font-semibold text-muted-foreground">
                      {formatTimeAgo(entry.latest.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
