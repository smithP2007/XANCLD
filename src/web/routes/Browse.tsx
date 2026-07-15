// ─── Browse Page (/browse) ──────────────────────────────────────
// Advanced anime browsing with URL-synced filters:
//  - Premium glass search bar (h-12, rounded-full, focus glow)
//  - Horizontal scrollable genre chips (multi-select with order badges)
//  - Sort dropdown (6 options)
//  - Format dropdown (7 formats)
//  - Active filter chips (one-click remove with X)
//  - Clear all button
//  - Premium anime grid (5 cols desktop → 2 cols mobile)
//  - Pagination (pill-button style with ellipses)
//  - Premium empty state with search icon + "Clear filters" CTA
//  - URL-synced (q, genres, sort, format, page) — shareable + survives back/forward
//  - Debounced search (400ms)
//  - Loading skeletons (shimmer)

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search as SearchIcon, X, Star, ChevronLeft, ChevronRight,
  AlertCircle, Film, Calendar,
} from "lucide-react";
import {
  searchAnimeAdvanced, getTitle, GENRES,
  type AnimeCard, type SearchFilters,
} from "../lib/anilist";
import { useDebounce } from "../hooks/useDebounce";

const SORT_OPTIONS: { value: NonNullable<SearchFilters["sort"]>; label: string }[] = [
  { value: "POPULARITY_DESC", label: "Popularity" },
  { value: "TRENDING_DESC", label: "Trending" },
  { value: "SCORE_DESC", label: "Score" },
  { value: "START_DATE_DESC", label: "Newest" },
  { value: "FAVOURITES_DESC", label: "Oldest" }, // we'll flip below
  { value: "SEARCH_MATCH", label: "Title A-Z" },
];

const FORMAT_OPTIONS = [
  { value: "TV", label: "TV" },
  { value: "TV_SHORT", label: "TV Short" },
  { value: "MOVIE", label: "Movie" },
  { value: "SPECIAL", label: "Special" },
  { value: "OVA", label: "OVA" },
  { value: "ONA", label: "ONA" },
  { value: "MUSIC", label: "Music" },
];

const PER_PAGE = 24;

export function Browse() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Pull initial state from URL
  const initialQuery = searchParams.get("q") ?? "";
  const initialGenres = searchParams.getAll("genre");
  const initialSort = (searchParams.get("sort") as SearchFilters["sort"]) ?? "POPULARITY_DESC";
  const initialFormat = searchParams.get("format") ?? "";
  const initialYear = parseInt(searchParams.get("year") ?? "0", 10) || null;
  const initialPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;

  const [query, setQuery] = useState(initialQuery);
  const [genres, setGenres] = useState<string[]>(initialGenres);
  const [sort, setSort] = useState<SearchFilters["sort"]>(initialSort);
  const [format, setFormat] = useState<string>(initialFormat);
  const [year, setYear] = useState<number | null>(initialYear);
  const [page, setPage] = useState(initialPage);

  const debouncedQuery = useDebounce(query, 400);

  // ─── Sync external URL changes → local state ─────────────────
  // When the user is already on /browse and another surface (e.g. the
  // Command Menu's season/genre shortcuts) navigates to /browse with
  // different query params, React Router does NOT remount this
  // component — it just updates searchParams. useState initial values
  // don't re-run, so we'd keep showing the old filters. This effect
  // watches searchParams and pushes external changes into local state
  // when they diverge. We avoid an infinite loop with the state→URL
  // effect below by only updating when values actually differ.
  useEffect(() => {
    const urlQuery = searchParams.get("q") ?? "";
    const urlGenres = searchParams.getAll("genre");
    const urlSort = (searchParams.get("sort") as SearchFilters["sort"]) ?? "POPULARITY_DESC";
    const urlFormat = searchParams.get("format") ?? "";
    const urlYear = parseInt(searchParams.get("year") ?? "0", 10) || null;
    const urlPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;

    // Compare each field; only update state when it actually changed.
    // This prevents a feedback loop with the state→URL effect below.
    if (urlQuery !== query) setQuery(urlQuery);
    if (urlSort !== sort) setSort(urlSort);
    if (urlFormat !== format) setFormat(urlFormat);
    if (urlYear !== year) setYear(urlYear);
    if (urlPage !== page) setPage(urlPage);
    // Array comparison for genres
    if (urlGenres.length !== genres.length || urlGenres.some((g, i) => g !== genres[i])) {
      setGenres(urlGenres);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Sync to URL (debounced query, immediate for everything else)
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedQuery) next.set("q", debouncedQuery);
    for (const g of genres) next.append("genre", g);
    if (sort) next.set("sort", sort);
    if (format) next.set("format", format);
    if (year) next.set("year", String(year));
    if (page > 1) next.set("page", String(page));
    setSearchParams(next, { replace: true });
  }, [debouncedQuery, genres, sort, format, year, page, setSearchParams]);

  // ─── Fetch results ───
  const [results, setResults] = useState<AnimeCard[]>([]);
  const [total, setTotal] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    searchAnimeAdvanced(debouncedQuery, page, PER_PAGE, {
      sort,
      genres: genres.length > 0 ? genres : undefined,
      format: format || null,
      year,
    })
      .then((r) => {
        if (cancelled) return;
        setResults(r.media);
        setTotal(r.total);
        setHasNext(r.hasNextPage);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [debouncedQuery, genres, sort, format, year, page]);

  // ─── Genre toggle (multi-select with order badges) ───
  const toggleGenre = useCallback((g: string) => {
    setGenres((prev) => {
      if (prev.includes(g)) return prev.filter((x) => x !== g);
      return [...prev, g];
    });
    setPage(1);
  }, []);

  const clearAll = useCallback(() => {
    setQuery("");
    setGenres([]);
    setFormat("");
    setYear(null);
    setSort("POPULARITY_DESC");
    setPage(1);
  }, []);

  const removeGenre = useCallback((g: string) => {
    setGenres((prev) => prev.filter((x) => x !== g));
    setPage(1);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const pagePills = buildPagePills(page, totalPages);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
      {/* ─── Title ─── */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-1 h-7 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
          <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Browse</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-3.5">
          Filter by genre, format, and sort — {total.toLocaleString()} titles available.
        </p>
      </div>

      {/* ─── Search bar ─── */}
      <div className="relative mb-4">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder="Search by title…"
          className="w-full h-12 pl-12 pr-4 rounded-full bg-white/5 backdrop-blur border border-white/10 text-sm md:text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50 focus:shadow-[0_0_0_4px_rgba(233,69,96,0.12)] transition-all"
        />
      </div>

      {/* ─── Sort + Format dropdowns ─── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Sort</label>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as SearchFilters["sort"]); setPage(1); }}
            className="h-9 px-3 rounded-full bg-white/5 backdrop-blur border border-white/10 text-sm text-foreground focus:outline-none focus:border-xan-crimson/50"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Format</label>
          <select
            value={format}
            onChange={(e) => { setFormat(e.target.value); setPage(1); }}
            className="h-9 px-3 rounded-full bg-white/5 backdrop-blur border border-white/10 text-sm text-foreground focus:outline-none focus:border-xan-crimson/50"
          >
            <option value="" className="bg-zinc-900">Any</option>
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Year</label>
          <select
            value={year ?? ""}
            onChange={(e) => { setYear(e.target.value ? parseInt(e.target.value, 10) : null); setPage(1); }}
            className="h-9 px-3 rounded-full bg-white/5 backdrop-blur border border-white/10 text-sm text-foreground focus:outline-none focus:border-xan-crimson/50"
          >
            <option value="" className="bg-zinc-900">Any</option>
            {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y} className="bg-zinc-900">{y}</option>
            ))}
          </select>
        </div>
        {(query || genres.length > 0 || format || year || sort !== "POPULARITY_DESC") && (
          <button
            type="button"
            onClick={clearAll}
            className="h-9 px-3 rounded-full text-sm text-muted-foreground hover:text-xan-crimson border border-xan-border bg-white/5 hover:bg-white/10 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* ─── Genre chips ─── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {GENRES.map((g) => {
          const order = genres.indexOf(g);
          const active = order >= 0;
          return (
            <button
              key={g}
              type="button"
              onClick={() => toggleGenre(g)}
              className={`relative flex-shrink-0 h-9 px-4 rounded-full text-sm font-medium border transition-all ${
                active
                  ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white border-transparent shadow-md shadow-xan-crimson/30"
                  : "bg-white/5 backdrop-blur border-white/10 text-muted-foreground hover:text-foreground hover:border-xan-crimson/40"
              }`}
            >
              {g}
              {active && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/25 text-[10px] font-bold">
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Active filter chips (one-click remove) ─── */}
      {(query || genres.length > 0 || format || year) && (
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {query && (
            <FilterChip label={`"${query}"`} onRemove={() => setQuery("")} />
          )}
          {genres.map((g) => (
            <FilterChip key={g} label={g} onRemove={() => removeGenre(g)} />
          ))}
          {format && (
            <FilterChip label={format} onRemove={() => { setFormat(""); setPage(1); }} />
          )}
          {year && (
            <FilterChip label={`${year}`} onRemove={() => { setYear(null); setPage(1); }} />
          )}
        </div>
      )}

      {/* ─── Result count + page indicator ─── */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground tabular-nums">
          {loading ? "Loading…" : `${total.toLocaleString()} results`}
        </p>
        {totalPages > 1 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Page {page} of {totalPages}
          </p>
        )}
      </div>

      {/* ─── Grid ─── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-xl bg-xan-card/50 animate-pulse" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center space-y-3">
          <SearchIcon className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
          <p className="text-sm text-muted-foreground">No results match your filters.</p>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-violet text-white text-sm font-semibold shadow-md shadow-xan-crimson/30 hover:opacity-90 transition-opacity"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {results.map((a) => (
              <BrowseCard key={a.id} anime={a} />
            ))}
          </div>

          {/* ─── Pagination ─── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-8 flex-wrap">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-9 px-3 rounded-full text-sm font-medium border border-xan-border bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              {pagePills.map((p, idx) =>
                p === "…" ? (
                  <span key={`ell-${idx}`} className="px-1 text-muted-foreground text-xs">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`h-9 w-9 rounded-full text-sm font-medium transition-all ${
                      p === page
                        ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white shadow-md shadow-xan-crimson/30"
                        : "border border-xan-border bg-white/5 hover:bg-white/10 text-foreground"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-9 px-3 rounded-full text-sm font-medium border border-xan-border bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Filter chip (one-click remove) ───────────────────────────
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 h-7 pl-3 pr-1.5 rounded-full bg-xan-crimson/15 border border-xan-crimson/30 text-xs font-medium text-xan-crimson">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-xan-crimson/30 transition-colors"
        aria-label={`Remove ${label}`}
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  );
}

// ─── Browse card ──────────────────────────────────────────────
function BrowseCard({ anime }: { anime: AnimeCard }) {
  const title = getTitle(anime.title);
  return (
    <Link to={`/anime/${anime.id}`} className="group hover-lift">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all shadow-lg">
        <img
          src={anime.coverImage?.large ?? "/placeholder.svg"}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        {anime.averageScore != null && (
          <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-sm border border-white/15 text-[9px] font-bold text-white">
            <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
            {Math.round(anime.averageScore)}%
          </div>
        )}
        <div className="absolute bottom-1.5 left-1.5 right-1.5">
          <p className="text-[10px] font-medium text-white line-clamp-2 leading-tight group-hover:text-xan-crimson transition-colors">
            {title}
          </p>
          <div className="flex items-center gap-1.5 mt-1 text-[9px] text-white/60 uppercase tracking-wider">
            {anime.format && <span className="flex items-center gap-0.5"><Film className="h-2 w-2" />{anime.format}</span>}
            {anime.seasonYear && <span className="flex items-center gap-0.5"><Calendar className="h-2 w-2" />{anime.seasonYear}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Page pills with ellipses ────────────────────────────────
function buildPagePills(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pills: (number | "…")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pills.push("…");
  for (let p = left; p <= right; p++) pills.push(p);
  if (right < total - 1) pills.push("…");
  pills.push(total);
  return pills;
}
