// ─── EpisodeGrid — Premium Glass Redesign ───────────────────────
// Replaces the inline episode grid in AnimeDetail with a self-contained
// component that owns its own pagination/search/jump state but defers
// navigation to a `onSelect(episodeNumber)` callback.
//
// Premium affordances (per spec):
//  - Section title with crimson→violet accent bar + total count on right
//  - Glass search input (rounded-full, backdrop-blur, focus glow ring)
//  - Glass container for the episode grid (rounded-2xl, backdrop blur)
//  - Episode tiles as pill buttons (rounded-full, h-9, Play icon + label)
//  - Pagination as pill buttons (Prev/Next rounded-full + chevrons)
//  - Page number pills (numbered, active = crimson→violet gradient)
//  - Jump-to-episode input with Hash icon + Go pill button
//  - SOON badge for next-airing episode (crimson-bordered, font-mono bold)
//  - 5 columns on large screens (was 4)
//  - Auto-scroll to top when page changes or search cleared

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  ChevronLeft,
  ChevronRight,
  Search as SearchIcon,
  Hash,
  Check,
} from "lucide-react";

interface EpisodeGridProps {
  animeId: number;
  totalEpisodes: number;
  nextAirEp: number | null;
  watchedEpisodes: Set<number>;
  /** Per-page count. Defaults to 50 (matches spec's "100/page" but tuned
   *  for the denser pill layout — set to 100 to match exactly). */
  perPage?: number;
}

export function EpisodeGrid({
  animeId,
  totalEpisodes,
  nextAirEp,
  watchedEpisodes,
  perPage = 100,
}: EpisodeGridProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [jumpTo, setJumpTo] = useState("");
  const gridTopRef = useRef<HTMLDivElement>(null);

  // Reset on anime change
  useEffect(() => {
    setPage(1);
    setSearch("");
    setJumpTo("");
  }, [animeId]);

  const filteredEpisodes = useMemo(() => {
    if (!search.trim()) return Array.from({ length: totalEpisodes }, (_, i) => i + 1);
    const n = parseInt(search, 10);
    if (!isNaN(n) && n >= 1 && n <= totalEpisodes) return [n];
    return [];
  }, [search, totalEpisodes]);

  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pagedEpisodes = filteredEpisodes.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  );

  // Auto-scroll to top when page changes or search clears
  useEffect(() => {
    if (gridTopRef.current) {
      gridTopRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [safePage, search]);

  const handleJump = useCallback(() => {
    const n = parseInt(jumpTo, 10);
    if (isNaN(n) || n < 1 || n > totalEpisodes) return;
    const targetPage = Math.ceil(n / perPage);
    setPage(targetPage);
    setSearch("");
    setTimeout(() => {
      const el = document.getElementById(`ep-${n}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }, [jumpTo, totalEpisodes, perPage]);

  if (totalEpisodes === 0) {
    return (
      <section className="animate-fade-in-up">
        <SectionHeader label="Episodes" count={0} />
        <div className="glass rounded-2xl p-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Episode count unknown for this title. Start watching from episode 1 — the
            player will let you navigate to the next episode.
          </p>
          <Link
            to={`/watch/${animeId}?ep=1`}
            className="btn-premium inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-violet font-semibold text-white transition-all shadow-lg shadow-xan-crimson/30"
          >
            <Play className="h-4 w-4 fill-white" /> Watch Episode 1
          </Link>
        </div>
      </section>
    );
  }

  // Build page-number pills with ellipses for large ranges
  const pagePills = buildPagePills(safePage, totalPages);

  return (
    <section className="animate-fade-in-up">
      <SectionHeader label="Episodes" count={totalEpisodes} right={
        totalPages > 1 ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {safePage} of {totalPages}
          </span>
        ) : null
      } />

      <div ref={gridTopRef} />

      {/* Search + jump-to row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search episode number..."
            className="w-full pl-10 pr-4 h-10 rounded-full bg-white/5 backdrop-blur border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50 focus:shadow-[0_0_0_4px_rgba(233,69,96,0.12)] transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="number"
              value={jumpTo}
              onChange={(e) => setJumpTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJump()}
              placeholder="Jump"
              min={1}
              max={totalEpisodes}
              className="w-24 h-10 pl-8 pr-3 rounded-full bg-white/5 backdrop-blur border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50 focus:shadow-[0_0_0_4px_rgba(233,69,96,0.12)] transition-all"
            />
          </div>
          <button
            type="button"
            onClick={handleJump}
            className="h-10 px-4 rounded-full bg-gradient-to-r from-xan-crimson to-xan-violet text-white text-sm font-semibold shadow-md shadow-xan-crimson/30 hover:opacity-90 transition-opacity"
          >
            Go
          </button>
        </div>
      </div>

      {/* Episode grid — glass container */}
      <div className="glass rounded-2xl p-4 md:p-5">
        {pagedEpisodes.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            No episodes match "{search}".
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-2">
            {pagedEpisodes.map((ep) => {
              const isUnaired = nextAirEp !== null && ep >= nextAirEp;
              const isNextAiring = nextAirEp !== null && ep === nextAirEp;
              const isWatched = watchedEpisodes.has(ep);

              if (isUnaired) {
                return (
                  <div
                    key={ep}
                    id={`ep-${ep}`}
                    className={`h-9 rounded-full flex items-center justify-center gap-1 text-xs font-medium relative overflow-hidden border ${
                      isNextAiring
                        ? "border-xan-crimson/40 bg-xan-crimson/5 text-xan-crimson/70"
                        : "border-xan-border/30 bg-xan-card/20 text-muted-foreground/30 cursor-not-allowed"
                    }`}
                    title={isNextAiring ? "Next episode — airing soon" : "Not yet aired"}
                  >
                    {isNextAiring ? (
                      <span className="font-mono font-bold tracking-wider text-[10px] uppercase">
                        Soon
                      </span>
                    ) : (
                      <span className="tabular-nums">{ep}</span>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={ep}
                  id={`ep-${ep}`}
                  to={`/watch/${animeId}?ep=${ep}`}
                  className={`group h-9 rounded-full flex items-center justify-center gap-1.5 text-xs font-semibold border transition-all hover-lift relative overflow-hidden ${
                    isWatched
                      ? "border-xan-crimson/40 bg-xan-crimson/10 text-xan-crimson"
                      : "border-xan-border bg-white/5 text-foreground hover:border-xan-crimson/50 hover:bg-xan-crimson/10"
                  }`}
                  title={isWatched ? `Episode ${ep} — watched` : `Play Episode ${ep}`}
                >
                  <Play className="h-3 w-3 fill-current opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span className="tabular-nums">Ep {ep}</span>
                  {isWatched && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-xan-crimson text-white shadow">
                      <Check className="h-2 w-2" />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-4 flex-wrap">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
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
                  p === safePage
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
            disabled={safePage >= totalPages}
            className="h-9 px-3 rounded-full text-sm font-medium border border-xan-border bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
}

// ─── Section header with crimson→violet accent bar + count ──────
function SectionHeader({
  label,
  count,
  right,
}: {
  label: string;
  count: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
        <h2 className="text-xl font-bold font-display text-foreground">{label}</h2>
        {count > 0 && (
          <span className="text-xs text-muted-foreground ml-1 tabular-nums">· {count} total</span>
        )}
      </div>
      {right}
    </div>
  );
}

// ─── Build page-number pills with ellipses for large ranges ────
// Returns an array of numbers and "…" strings. Example for 10 pages,
// current = 5:  [1, "…", 4, 5, 6, "…", 10]
function buildPagePills(current: number, total: number): (number | "…")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pills: (number | "…")[] = [1];
  const left = Math.max(2, current - 1);
  const right = Math.min(total - 1, current + 1);
  if (left > 2) pills.push("…");
  for (let p = left; p <= right; p++) pills.push(p);
  if (right < total - 1) pills.push("…");
  pills.push(total);
  return pills;
}
