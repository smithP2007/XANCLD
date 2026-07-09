import { useState, useEffect } from "react";
import { Flame, AlertCircle, ChevronLeft, ChevronRight, Compass } from "lucide-react";
import { fetchTrendingPage, type AnimeCard as AnimeCardType } from "../lib/anilist";
import { AnimeCard } from "../components/AnimeCard";
import { AnimeCardSkeleton } from "../components/AnimeCardSkeleton";

const PER_PAGE = 24;

export function Trending() {
  const [anime, setAnime] = useState<AnimeCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageChanging, setPageChanging] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { media, hasNextPage, total: t } = await fetchTrendingPage(1, PER_PAGE);
        setAnime(media);
        setHasNext(hasNextPage);
        setTotal(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const goToPage = async (newPage: number) => {
    if (newPage < 1 || pageChanging) return;
    setPageChanging(true);
    setError(null);
    try {
      const { media, hasNextPage, total: t } = await fetchTrendingPage(newPage, PER_PAGE);
      setAnime(media);
      setHasNext(hasNextPage);
      setTotal(t);
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setPageChanging(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center glow-crimson">
          <Compass className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Discover Anime</h1>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? `${total} anime to explore` : "Browse trending and popular titles"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {anime.map((a, i) => (
          <AnimeCard key={a.id} anime={a} index={i} />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-xan-border">
        <p className="text-sm text-muted-foreground">
          Page <span className="text-foreground font-medium">{page}</span> of{" "}
          <span className="text-foreground font-medium">{totalPages}</span>
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1 || pageChanging}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-xan-border bg-xan-card hover:bg-xan-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={!hasNext || pageChanging}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-xan-border bg-xan-card hover:bg-xan-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl skeleton" />
        <div className="space-y-2">
          <div className="h-6 w-32 rounded skeleton" />
          <div className="h-3 w-48 rounded skeleton" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 18 }, (_, i) => (
          <AnimeCardSkeleton key={i} />
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
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 rounded-lg bg-xan-card border border-xan-border hover:bg-xan-card-hover text-sm"
      >
        Retry
      </button>
    </div>
  );
}
