import { useState, useEffect } from "react";
import { Flame, Loader2, AlertCircle } from "lucide-react";
import { fetchTrendingPage, type AnimeCard as AnimeCardType } from "../lib/anilist";
import { AnimeCard } from "../components/AnimeCard";

export function Trending() {
  const [anime, setAnime] = useState<AnimeCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { media, hasNextPage } = await fetchTrendingPage(1, 24);
        setAnime(media);
        setHasNext(hasNextPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    const next = page + 1;
    const { media, hasNextPage } = await fetchTrendingPage(next, 24);
    setAnime((prev) => [...prev, ...media]);
    setHasNext(hasNextPage);
    setPage(next);
    setLoadingMore(false);
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center glow-crimson">
          <Flame className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Trending</h1>
          <p className="text-sm text-muted-foreground">The hottest anime right now</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {anime.map((a, i) => (
          <div
            key={a.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${Math.min(i * 30, 600)}ms` }}
          >
            <AnimeCard anime={a} />
          </div>
        ))}
      </div>

      {hasNext && (
        <div className="text-center mt-10">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-premium inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-crimson-dark hover:from-xan-crimson-dark hover:to-xan-crimson font-semibold text-white shadow-lg shadow-xan-crimson/30 disabled:opacity-50 transition-all"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </>
            ) : (
              "Load More"
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-xan-card skeleton" />
        <div className="space-y-2">
          <div className="h-6 w-32 rounded skeleton" />
          <div className="h-3 w-48 rounded skeleton" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 18 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="aspect-[2/3] rounded-xl skeleton" />
            <div className="h-3 w-full rounded skeleton" />
            <div className="h-3 w-2/3 rounded skeleton" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <AlertCircle className="h-10 w-10 text-xan-crimson mb-3" />
      <p className="text-lg font-medium">Failed to load</p>
      <p className="text-sm text-muted-foreground mt-1">{message}</p>
    </div>
  );
}
