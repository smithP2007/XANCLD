import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  Search as SearchIcon,
  SearchX,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  searchAnimeAdvanced,
  SORT_OPTIONS,
  FORMAT_OPTIONS,
  GENRES,
  type AnimeCard as AnimeCardType,
  type SearchFilters,
} from "../lib/anilist";
import { AnimeCard } from "../components/AnimeCard";
import { AnimeCardSkeleton } from "../components/AnimeCardSkeleton";
import { useDebounce } from "../hooks/useDebounce";

const PER_PAGE = 24;

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const [query, setQuery] = useState(q);
  const debouncedQuery = useDebounce(query, 400);

  // Filters from URL
  const sort = (searchParams.get("sort") as SearchFilters["sort"]) || "SEARCH_MATCH";
  const format = searchParams.get("format") || "";
  const genresParam = searchParams.get("genres") || "";
  const selectedGenres = useMemo(
    () => (genresParam ? genresParam.split(",").filter(Boolean) : []),
    [genresParam],
  );
  const page = parseInt(searchParams.get("page") || "1", 10);

  const [results, setResults] = useState<AnimeCardType[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNext, setHasNext] = useState(false);
  const [total, setTotal] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep input in sync when URL changes externally (e.g., navbar search)
  useEffect(() => {
    setQuery(q);
  }, [q]);

  // Sync debounced query to URL
  useEffect(() => {
    if (debouncedQuery !== q) {
      const next = new URLSearchParams(searchParams);
      if (debouncedQuery) next.set("q", debouncedQuery);
      else next.delete("q");
      next.delete("page");
      setSearchParams(next, { replace: true });
    }
  }, [debouncedQuery]);

  // Fetch results
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const filters: SearchFilters = {
          sort,
          format: format || null,
          genres: selectedGenres,
        };
        const { media, hasNextPage, total: t } = await searchAnimeAdvanced(
          q,
          page,
          PER_PAGE,
          filters,
        );
        setResults(media);
        setHasNext(hasNextPage);
        setTotal(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [q, sort, format, genresParam, page]);

  const updateFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setSearchParams(next, { replace: false });
  };

  const toggleGenre = (genre: string) => {
    const next = selectedGenres.includes(genre)
      ? selectedGenres.filter((g) => g !== genre)
      : [...selectedGenres, genre];
    updateFilter("genres", next.length > 0 ? next.join(",") : null);
  };

  const clearAllFilters = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("sort");
    next.delete("format");
    next.delete("genres");
    next.delete("page");
    setSearchParams(next, { replace: false });
  };

  const hasActiveFilters = !!(sort && sort !== "SEARCH_MATCH") || !!format || selectedGenres.length > 0;

  const goToPage = (newPage: number) => {
    if (newPage < 1) return;
    const next = new URLSearchParams(searchParams);
    if (newPage === 1) next.delete("page");
    else next.set("page", String(newPage));
    setSearchParams(next, { replace: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Search</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {total > 0 ? (
              <>
                <span className="text-foreground font-medium">{total}</span> result
                {total === 1 ? "" : "s"}
                {q && (
                  <>
                    {" "}for <span className="text-foreground font-medium">"{q}"</span>
                  </>
                )}
              </>
            ) : (
              "Find your next favorite anime"
            )}
          </p>
        </div>

        {/* Big search bar */}
        <div className="relative max-w-2xl">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search anime by title..."
            className="w-full pl-10 pr-10 h-11 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50 focus:ring-2 focus:ring-xan-crimson/30"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {(hasActiveFilters || selectedGenres.length > 0) && (
          <div className="flex flex-wrap items-center gap-2">
            {sort && sort !== "SEARCH_MATCH" && (
              <FilterChip
                label={`Sort: ${SORT_OPTIONS.find((o) => o.value === sort)?.label}`}
                onRemove={() => updateFilter("sort", null)}
              />
            )}
            {format && (
              <FilterChip
                label={`Format: ${FORMAT_OPTIONS.find((o) => o.value === format)?.label}`}
                onRemove={() => updateFilter("format", null)}
              />
            )}
            {selectedGenres.map((g) => (
              <FilterChip key={g} label={g} onRemove={() => toggleGenre(g)} />
            ))}
            <button
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground hover:text-xan-crimson underline ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar filter panel */}
        <aside className="lg:w-64 flex-shrink-0">
          <div className="lg:sticky lg:top-20">
            <button
              onClick={() => setFilterOpen((v) => !v)}
              className="lg:hidden w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-xan-card border border-xan-border text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <span className="px-1.5 py-0.5 rounded-full bg-xan-crimson text-white text-[10px] font-bold">
                    {selectedGenres.length + (format ? 1 : 0) + (sort !== "SEARCH_MATCH" ? 1 : 0)}
                  </span>
                )}
              </span>
              <ChevronRight
                className={`h-4 w-4 transition-transform ${filterOpen ? "rotate-90" : ""}`}
              />
            </button>

            <div className={`${filterOpen ? "block" : "hidden"} lg:block space-y-5 mt-3 lg:mt-0`}>
              {/* Sort */}
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Sort by
                </h3>
                <select
                  value={sort}
                  onChange={(e) => updateFilter("sort", e.target.value)}
                  className="w-full h-9 px-3 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground focus:outline-none focus:border-xan-crimson/50"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Format */}
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Format
                </h3>
                <select
                  value={format}
                  onChange={(e) => updateFilter("format", e.target.value || null)}
                  className="w-full h-9 px-3 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground focus:outline-none focus:border-xan-crimson/50"
                >
                  <option value="">Any</option>
                  {FORMAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Genres */}
              <div>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                  Genres
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {GENRES.map((g) => {
                    const active = selectedGenres.includes(g);
                    return (
                      <button
                        key={g}
                        onClick={() => toggleGenre(g)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          active
                            ? "bg-xan-crimson text-white border border-xan-crimson"
                            : "bg-xan-card text-muted-foreground hover:text-foreground hover:bg-xan-card-hover border border-xan-border"
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="w-full px-3 py-2 rounded-lg border border-xan-border text-xs text-muted-foreground hover:text-xan-crimson hover:border-xan-crimson/40 transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 12 }, (_, i) => (
                <AnimeCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <SearchX className="h-10 w-10 text-xan-crimson mb-3" />
              <p className="text-lg font-medium">Search failed</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 rounded-lg bg-xan-card border border-xan-border hover:bg-xan-card-hover text-sm"
              >
                Retry
              </button>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border border-xan-border rounded-xl bg-xan-card/30">
              <SearchX className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-lg font-medium text-foreground">No results found</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                {q
                  ? `We couldn't find any anime matching "${q}". Try different keywords or remove some filters.`
                  : "Start typing to search, or apply filters to browse."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {results.map((a, idx) => (
                  <AnimeCard key={a.id} anime={a} index={idx} />
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
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-xan-border bg-xan-card hover:bg-xan-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={!hasNext}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-xan-border bg-xan-card hover:bg-xan-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-xan-crimson/15 border border-xan-crimson/30 text-xs font-medium text-xan-crimson">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-xan-crimson/20 rounded-full p-0.5 -mr-0.5"
        aria-label={`Remove ${label}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
