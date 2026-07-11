import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Search, X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  animeId: number;
  currentEpisode: number;
  totalEpisodes: number;
  nextAirEp: number | null;
  /** Called when an episode link is clicked (e.g. to close a sheet). Optional. */
  onPick?: () => void;
}

/**
 * EpisodePanel — paginated episode grid for the Watch page sidebar (PC) and
 * the mobile bottom-sheet.
 *
 * 50 episodes per page with prev/next + page-jumper buttons. Auto-opens to
 * the page containing `currentEpisode` so the episode you're watching is
 * always visible. Search filters to a single matching episode.
 *
 * Used by:
 *   - Watch.tsx sidebar (desktop + mobile)
 *   - Could be reused by AnimeDetail desktop grid in the future
 */
const PAGE_SIZE = 50;

export function EpisodePanel({
  animeId,
  currentEpisode,
  totalEpisodes,
  nextAirEp,
  onPick,
}: Props) {
  const [search, setSearch] = useState("");

  // Compute the filtered episode list (search returns a single match)
  const filteredEpisodes = useMemo(() => {
    if (!totalEpisodes || totalEpisodes <= 0) return [];
    const all = Array.from({ length: totalEpisodes }, (_, i) => i + 1);
    if (!search.trim()) return all;
    const n = parseInt(search, 10);
    if (!isNaN(n) && n >= 1 && n <= totalEpisodes) return [n];
    return [];
  }, [search, totalEpisodes]);

  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / PAGE_SIZE));

  // Default to the page containing the current episode
  const initialPage = useMemo(() => {
    if (currentEpisode > 0 && totalEpisodes > 0) {
      return Math.min(
        totalPages,
        Math.max(1, Math.ceil(currentEpisode / PAGE_SIZE)),
      );
    }
    return 1;
  }, [currentEpisode, totalEpisodes, totalPages]);

  const [page, setPage] = useState(initialPage);
  const scrollRef = useRef<HTMLDivElement>(null);

  // When currentEpisode changes (user navigates to a different episode),
  // jump to that episode's page so the sidebar stays in sync.
  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  // When searching, reset to page 1
  useEffect(() => {
    if (search.trim()) setPage(1);
  }, [search]);

  // Clamp page if totalPages changed
  useEffect(() => {
    if (page > totalPages) setPage(Math.max(1, totalPages));
  }, [page, totalPages]);

  const visibleEpisodes = filteredEpisodes.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  const pageStart = (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, filteredEpisodes.length);

  if (totalEpisodes <= 0) {
    return <p className="text-xs text-muted-foreground text-center py-4">Episode count unknown</p>;
  }

  return (
    <div>
      {/* Search + jump-to (only when there are enough episodes to paginate) */}
      {totalEpisodes > PAGE_SIZE && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            inputMode="numeric"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search episode number..."
            className="w-full pl-9 pr-9 h-8 rounded-lg bg-xan-card border border-xan-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Page range indicator */}
      {filteredEpisodes.length > PAGE_SIZE && (
        <div className="flex items-center justify-between mb-2 text-[10px] text-muted-foreground">
          <span>
            <span className="text-foreground font-semibold">{pageStart}-{pageEnd}</span> of {filteredEpisodes.length}
          </span>
          <span>
            Page <span className="text-foreground font-semibold">{page}</span> / {totalPages}
          </span>
        </div>
      )}

      {/* Episode grid */}
      <div ref={scrollRef} className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-72 overflow-y-auto pr-1 no-scrollbar">
        {visibleEpisodes.map((ep) => {
          const isUnaired = nextAirEp !== null && ep >= nextAirEp;
          const isNextAiring = nextAirEp !== null && ep === nextAirEp;
          const isCurrent = ep === currentEpisode;
          if (isUnaired) {
            return (
              <div
                key={ep}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-xs font-medium cursor-not-allowed relative ${
                  isNextAiring
                    ? "bg-xan-crimson/5 border border-xan-crimson/20 text-xan-crimson/30"
                    : "bg-xan-card/20 border border-xan-border/20 text-muted-foreground/20"
                }`}
                title={isNextAiring ? "Airing soon" : "Not yet aired"}
              >
                {ep}
                {isNextAiring && (
                  <span className="text-[7px] font-bold text-xan-crimson/50 uppercase">Soon</span>
                )}
              </div>
            );
          }
          return (
            <Link
              key={ep}
              to={`/watch/${animeId}?ep=${ep}`}
              onClick={onPick}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                isCurrent
                  ? "bg-gradient-to-br from-xan-crimson to-xan-violet text-white shadow-md shadow-xan-crimson/30"
                  : "bg-xan-card-hover text-muted-foreground hover:text-foreground hover:bg-xan-card border border-transparent hover:border-xan-crimson/30"
              }`}
            >
              {ep}
            </Link>
          );
        })}
      </div>

      {/* No results from search */}
      {filteredEpisodes.length === 0 && search.trim() && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          No episode matches "{search}"
        </p>
      )}

      {/* Pagination — prev/next + page jumper */}
      {filteredEpisodes.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between gap-1.5 pt-3 border-t border-xan-border/40">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex items-center gap-0.5 px-2 h-7 rounded-md border border-xan-border bg-xan-card hover:bg-xan-card-hover disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-medium transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>

          {/* Page jumper — side scroll to any page */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                if (p === 1 || p === totalPages) return true;
                if (Math.abs(p - page) <= 1) return true;
                return false;
              })
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev !== undefined && p - prev > 1;
                return (
                  <span key={p} className="flex items-center">
                    {showEllipsis && (
                      <span className="px-0.5 text-muted-foreground text-[10px]">…</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setPage(p)}
                      aria-label={`Go to page ${p}`}
                      aria-current={p === page}
                      className={`flex-shrink-0 w-6 h-6 rounded-md text-[10px] font-semibold transition-colors ${
                        p === page
                          ? "bg-gradient-to-br from-xan-crimson to-xan-violet text-white shadow-sm"
                          : "bg-xan-card text-muted-foreground hover:text-foreground hover:bg-xan-card-hover border border-xan-border"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex items-center gap-0.5 px-2 h-7 rounded-md border border-xan-border bg-xan-card hover:bg-xan-card-hover disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-medium transition-colors"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
