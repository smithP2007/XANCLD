import { useRef } from "react";
import { Link } from "react-router-dom";
import { History, Play, ChevronRight, ChevronLeft } from "lucide-react";
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
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-xan-card border border-xan-border flex items-center justify-center">
            <History className="h-4 w-4 text-xan-crimson" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold font-display text-foreground">
              Continue Watching
            </h2>
            <p className="text-[11px] text-muted-foreground">Pick up where you left off</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollBy("left")}
            aria-label="Scroll left"
            className="rounded-full glass border border-xan-border hover:bg-white/10 h-8 w-8 md:h-9 md:w-9 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollBy("right")}
            aria-label="Scroll right"
            className="rounded-full glass border border-xan-border hover:bg-white/10 h-8 w-8 md:h-9 md:w-9 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2 mask-fade-r"
      >
        {grouped.map((entry, idx) => {
          const progress = formatProgress(entry.latest.timestamp, entry.latest.duration);
          const epCount = entry.episodes.length;
          return (
            <Link
              key={entry.animeId}
              to={`/watch/${entry.animeId}?ep=${entry.latest.episode}`}
              className="group block flex-shrink-0 w-[140px] sm:w-[150px] snap-start card-enter"
              style={{ "--card-index": idx } as React.CSSProperties}
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-xan-card border border-xan-border hover:border-xan-crimson/40 transition-colors">
                <img
                  src={entry.coverImage || "/placeholder.svg"}
                  alt={entry.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-80 transition-opacity"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />

                {epCount > 1 && (
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-black/70 backdrop-blur-sm text-white">
                    {epCount} eps
                  </div>
                )}

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-9 h-9 rounded-full bg-xan-crimson/95 flex items-center justify-center shadow-lg scale-90 group-hover:scale-100 transition-transform">
                    <Play className="h-4 w-4 text-white fill-white ml-0.5" />
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-[11px] font-medium text-white line-clamp-1 leading-tight">
                    {entry.title}
                  </p>
                  <p className="text-[9px] text-white/60 mt-0.5">
                    EP {entry.latest.episode} • {formatTimeAgo(entry.latest.updatedAt)}
                  </p>
                  <div className="mt-1.5 h-0.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full bg-xan-crimson"
                      style={{ width: `${progress}%` }}
                    />
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
