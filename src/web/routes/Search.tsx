import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Search as SearchIcon,
  SearchX,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  Clock,
  Trash2,
  Shuffle,
} from "lucide-react";
import {
  searchAnimeAdvanced,
  fetchSearchSuggestions,
  fetchTrending,
  SORT_OPTIONS,
  FORMAT_OPTIONS,
  GENRES,
  getTitle,
  type AnimeCard as AnimeCardType,
  type SearchFilters,
} from "../lib/anilist";
import { AnimeCard } from "../components/AnimeCard";
import { AnimeCardSkeleton } from "../components/AnimeCardSkeleton";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { useDebounce } from "../hooks/useDebounce";
import { useRecentSearches } from "../hooks/useRecentSearches";

const PER_PAGE = 24;

export function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const q = searchParams.get("q") || "";
  const [query, setQuery] = useState(q);
  const debouncedQuery = useDebounce(query, 400);
  const [inputFocused, setInputFocused] = useState(false);

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

  // Recent searches (redesign plan §4)
  const { recent, add: addRecent, remove: removeRecent, clearAll: clearRecent } = useRecentSearches();

  // Inline thumbnail suggestions while typing (redesign plan §4)
  const [suggestions, setSuggestions] = useState<AnimeCardType[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const suggestionBoxRef = useRef<HTMLDivElement>(null);

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

  // ─── Fetch inline suggestions while typing (redesign plan §4) ───
  // Only show when input is focused + has 2+ chars + the debounced query
  // differs from the committed URL query (otherwise it'd persist after submit).
  useEffect(() => {
    const trimmed = query.trim();
    if (!inputFocused || trimmed.length < 2 || trimmed === q) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSuggestionsLoading(true);
    (async () => {
      try {
        const sug = await fetchSearchSuggestions(trimmed, 6);
        if (!cancelled) setSuggestions(sug);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, inputFocused, q]);

  // ─── Fetch results ───
  // FIX: when no query is present, use POPULARITY_DESC instead of SEARCH_MATCH.
  // SEARCH_MATCH without a search term returns obscure educational anime
  // ("Flash Eigo", "Rhythm Eigo") instead of popular titles. This was the
  // root cause of "search not working properly" on the empty /search page.
  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // When no query: browse mode — fall back to a sensible sort.
        const effectiveSort: SearchFilters["sort"] = q
          ? sort
          : sort === "SEARCH_MATCH"
            ? "POPULARITY_DESC"
            : sort;
        const filters: SearchFilters = {
          sort: effectiveSort,
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

  // Record a search to recent-searches when the user commits a query
  // (i.e. when `q` changes to a non-empty value). Guard against duplicate
  // recording when the same query is re-committed (e.g. from navbar nav
  // to the same term, or when URL params change without the query changing).
  const lastRecordedRef = useRef<string | null>(null);
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed && trimmed !== lastRecordedRef.current) {
      addRecent(trimmed);
      lastRecordedRef.current = trimmed;
    }
  }, [q]);

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

  // "Surprise Me" — pick a random trending anime (redesign plan §4)
  const handleSurprise = async () => {
    try {
      const trending = await fetchTrending(20);
      if (trending.length > 0) {
        const pick = trending[Math.floor(Math.random() * trending.length)];
        navigate(`/anime/${pick.id}`);
      }
    } catch {
      // ignore
    }
  };

  // Submit handler — commits the typed query to the URL
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    const next = new URLSearchParams(searchParams);
    if (trimmed) next.set("q", trimmed);
    else next.delete("q");
    next.delete("page");
    setSearchParams(next, { replace: false });
    setInputFocused(false);
  };

  // Click a suggestion → navigate to its detail page
  const pickSuggestion = (anime: AnimeCardType) => {
    navigate(`/anime/${anime.id}`);
    setInputFocused(false);
  };

  // Click a recent search → re-run it
  const pickRecent = (term: string) => {
    setQuery(term);
    const next = new URLSearchParams(searchParams);
    next.set("q", term);
    next.delete("page");
    setSearchParams(next, { replace: false });
    setInputFocused(false);
  };

  const showSuggestions = inputFocused && suggestions.length > 0;
  const showRecent = inputFocused && !query.trim() && recent.length > 0;

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

        {/* Big search bar with suggestions dropdown */}
        <div className="relative max-w-2xl">
          <form onSubmit={handleSubmit}>
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => {
                // Delay so click events on suggestions/recent fire first
                setTimeout(() => setInputFocused(false), 150);
              }}
              placeholder="Search anime by title..."
              autoComplete="off"
              className="w-full pl-10 pr-10 h-11 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50 focus:ring-2 focus:ring-xan-crimson/30"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </form>

          {/* Inline thumbnail suggestions (redesign plan §4) */}
          {showSuggestions && (
            <div
              ref={suggestionBoxRef}
              className="absolute z-30 left-0 right-0 mt-2 rounded-xl glass-strong border border-xan-border shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-panel-up"
            >
              {suggestionsLoading && (
                <div className="px-4 py-2 text-xs text-muted-foreground border-b border-xan-border">
                  Searching...
                </div>
              )}
              {!suggestionsLoading && suggestions.map((s) => {
                const title = getTitle(s.title);
                const img = s.coverImage?.large ?? s.coverImage?.extraLarge ?? "/placeholder.svg";
                return (
                  <button
                    key={s.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-xan-card-hover transition-colors text-left"
                  >
                    <img
                      src={img}
                      alt=""
                      className="w-8 h-12 object-cover rounded flex-shrink-0"
                      loading="lazy"
                      onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.format && <span>{s.format}</span>}
                        {s.seasonYear && <span> · {s.seasonYear}</span>}
                        {s.averageScore != null && <span> · {Math.round(s.averageScore)}%</span>}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Recent searches (redesign plan §4) — shown when input is empty + focused */}
          {showRecent && (
            <div className="absolute z-30 left-0 right-0 mt-2 rounded-xl glass-strong border border-xan-border shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-panel-up">
              <div className="flex items-center justify-between px-4 py-2 border-b border-xan-border">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> Recent searches
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearRecent}
                  className="text-xs text-muted-foreground hover:text-xan-crimson flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              </div>
              {recent.map((r) => (
                <div
                  key={r.query}
                  className="flex items-center group"
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickRecent(r.query)}
                    className="flex-1 flex items-center gap-2 px-4 py-2 hover:bg-xan-card-hover transition-colors text-left text-sm text-foreground"
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="line-clamp-1">{r.query}</span>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => removeRecent(r.query)}
                    aria-label={`Remove "${r.query}"`}
                    className="px-3 py-2 text-muted-foreground hover:text-xan-crimson opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
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
            <ErrorState
              message="Search hit a snag"
              description={error}
              onRetry={() => window.location.reload()}
            />
          ) : results.length === 0 ? (
            <EmptyState
              mascotMood="curious"
              title={q ? `No results for "${q}"` : "No results found"}
              description={
                q
                  ? "We couldn't find any anime matching that. Try different keywords or remove some filters."
                  : "Start typing to search, or apply filters to browse."
              }
              actionLabel="Surprise Me"
              onAction={handleSurprise}
              secondaryLabel="Browse trending"
              onSecondary={() => navigate("/trending")}
            />
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
