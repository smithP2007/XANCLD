import { useState, useEffect } from "react";
import { Flame, TrendingUp, Sparkles, AlertCircle } from "lucide-react";
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
