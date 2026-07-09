import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Flame, TrendingUp, Sparkles, AlertCircle, Clock, ChevronRight, Play } from "lucide-react";
import {
  fetchTrending,
  fetchPopular,
  type AnimeCard as AnimeCardType,
} from "../lib/anilist";
import { AnimeCard } from "../components/AnimeCard";
import { AnimeCardSkeleton } from "../components/AnimeCardSkeleton";
import { HeroCarousel } from "../components/HeroCarousel";
import { ContinueWatching } from "../components/ContinueWatching";
import { SectionRow } from "../components/SectionRow";
import { useWatchHistory, type HistoryEntry } from "../hooks/useSettings";
import { formatTimeAgo } from "../hooks/useCountdownTick";

export function Home() {
  const [trending, setTrending] = useState<AnimeCardType[]>([]);
  const [popular, setPopular] = useState<AnimeCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [t, p] = await Promise.all([fetchTrending(10), fetchPopular(18)]);
        setTrending(t);
        setPopular(p);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Hero skeleton
  if (loading && trending.length === 0) {
    return (
      <div className="relative">
        <section className="relative w-full h-[58vh] min-h-[420px] max-h-[560px] md:h-[78vh] md:min-h-[520px] md:max-h-[760px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-xan-card via-xan-dark to-xan-dark animate-shimmer" />
          <div className="relative h-full max-w-7xl mx-auto px-4 md:px-6 flex items-center pb-16 md:pb-20">
            <div className="space-y-4 w-full max-w-2xl">
              <div className="h-4 w-32 bg-white/10 rounded animate-shimmer" />
              <div className="h-16 w-3/4 bg-white/10 rounded animate-shimmer" />
              <div className="h-4 w-1/2 bg-white/5 rounded animate-shimmer" />
              <div className="flex gap-3 pt-2">
                <div className="h-12 w-36 bg-white/10 rounded-full animate-shimmer" />
                <div className="h-12 w-32 bg-white/5 rounded-full animate-shimmer" />
              </div>
            </div>
          </div>
        </section>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 space-y-10">
          <section className="space-y-4">
            <div className="h-8 w-40 bg-xan-card rounded animate-shimmer" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }, (_, i) => (
                <AnimeCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error && trending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle className="h-10 w-10 text-xan-crimson mb-3" />
        <p className="text-lg font-medium">Failed to load</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="relative -mt-16">
      {/* Hero */}
      {trending.length > 0 && <HeroCarousel anime={trending} />}

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-14 space-y-12 md:space-y-16">
        {/* Continue Watching (auto-hides if empty) */}
        <ContinueWatching />

        {/* Recent History — small section showing last watched */}
        <RecentHistorySection />

        {/* Trending row */}
        {trending.length > 0 && (
          <SectionRow
            title="Trending Now"
            subtitle="The hottest anime right now"
            icon={<TrendingUp className="h-4 w-4 text-xan-crimson" />}
          >
            {trending.map((a, idx) => (
              <div
                key={a.id}
                className="flex-shrink-0 w-[160px] sm:w-[180px] snap-start"
              >
                <AnimeCard anime={a} index={idx} />
              </div>
            ))}
          </SectionRow>
        )}

        {/* Popular row */}
        {popular.length > 0 && (
          <SectionRow
            title="Popular Anime"
            subtitle="All-time most watched"
            icon={<Sparkles className="h-4 w-4 text-xan-crimson" />}
          >
            {popular.map((a, idx) => (
              <div
                key={a.id}
                className="flex-shrink-0 w-[160px] sm:w-[180px] snap-start"
              >
                <AnimeCard anime={a} index={idx} />
              </div>
            ))}
          </SectionRow>
        )}

        {/* Top picks grid — flat grid of popular anime */}
        {popular.length > 6 && (
          <section className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-xan-card border border-xan-border flex items-center justify-center">
                <Flame className="h-4 w-4 text-xan-crimson" />
              </div>
              <div>
                <h2 className="text-lg md:text-xl font-bold font-display text-foreground">
                  More to Explore
                </h2>
                <p className="text-[11px] text-muted-foreground">Discover something new</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {popular.slice(6).map((a, idx) => (
                <AnimeCard key={a.id} anime={a} index={idx} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Recent History section ───────────────────────────────────
// Shows the last 6 watched episodes as compact cards. Auto-hides if empty.
function RecentHistorySection() {
  const history = useWatchHistory();

  if (history.length === 0) return null;

  // Deduplicate by anime (show only the latest episode per anime)
  const seen = new Set<number>();
  const recent = history
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((e) => {
      if (seen.has(e.animeId)) return false;
      seen.add(e.animeId);
      return true;
    })
    .slice(0, 6);

  if (recent.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-xan-card border border-xan-border flex items-center justify-center">
            <Clock className="h-4 w-4 text-xan-crimson" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold font-display text-foreground">
              Recently Watched
            </h2>
            <p className="text-[11px] text-muted-foreground">Pick up where you left off</p>
          </div>
        </div>
        <Link
          to="/history"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-xan-crimson transition-colors"
        >
          View all
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {recent.map((entry, idx) => (
          <RecentHistoryCard key={`${entry.animeId}-${entry.episode}`} entry={entry} index={idx} />
        ))}
      </div>
    </section>
  );
}

function RecentHistoryCard({ entry, index }: { entry: HistoryEntry; index: number }) {
  const progress = entry.duration > 0 ? (entry.timestamp / entry.duration) * 100 : 0;
  return (
    <Link
      to={`/watch/${entry.animeId}?ep=${entry.episode}`}
      className="group relative aspect-video rounded-lg overflow-hidden bg-xan-card border border-xan-border hover:border-xan-crimson/40 transition-all card-enter"
      style={{ "--card-index": index } as React.CSSProperties}
    >
      <img
        src={entry.coverImage || "/placeholder.svg"}
        alt={entry.title}
        loading="lazy"
        className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-80 transition-opacity"
        onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-9 h-9 rounded-full bg-xan-crimson/95 flex items-center justify-center shadow-lg scale-90 group-hover:scale-100 transition-transform">
          <Play className="h-4 w-4 text-white fill-white ml-0.5" />
        </div>
      </div>
      {/* Episode badge */}
      <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-black/80 backdrop-blur text-white">
        EP {entry.episode}
      </div>
      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-[11px] font-medium text-white line-clamp-1 leading-tight">
          {entry.title}
        </p>
        <p className="text-[9px] text-white/60 mt-0.5">{formatTimeAgo(entry.updatedAt)}</p>
        {/* Mini progress bar */}
        <div className="mt-1 h-0.5 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full bg-xan-crimson" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
      </div>
    </Link>
  );
}
