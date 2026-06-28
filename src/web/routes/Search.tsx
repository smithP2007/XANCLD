import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Search as SearchIcon, Film } from "lucide-react";
import { searchAnime, type AnimeCard as AnimeCardType } from "../lib/anilist";
import { AnimeCard } from "../components/AnimeCard";

export function Search() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const [results, setResults] = useState<AnimeCardType[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    if (!q) return;
    (async () => {
      setLoading(true);
      setPage(1);
      const { media, hasNextPage } = await searchAnime(q, 1);
      setResults(media);
      setHasNext(hasNextPage);
      setLoading(false);
    })();
  }, [q]);

  const loadMore = async () => {
    const next = page + 1;
    const { media, hasNextPage } = await searchAnime(q, next);
    setResults((prev) => [...prev, ...media]);
    setHasNext(hasNextPage);
    setPage(next);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <h1 className="text-2xl font-bold font-display text-foreground mb-1">Search</h1>
      <p className="text-muted-foreground mb-6">
        Results for: <span className="text-foreground font-medium">{q}</span>
      </p>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-xan-crimson" />
        </div>
      ) : results.length === 0 ? (
        <div className="text-center py-20">
          <SearchIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No results found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {results.map((a) => (
              <AnimeCard key={a.id} anime={a} />
            ))}
          </div>
          {hasNext && (
            <div className="text-center mt-8">
              <button
                onClick={loadMore}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-xan-card border border-xan-border hover:border-xan-crimson/50 hover:bg-xan-card-hover transition-all text-sm font-medium"
              >
                <Film className="h-4 w-4" /> Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
