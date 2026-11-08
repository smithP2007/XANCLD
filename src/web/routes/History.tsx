import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { History as HistoryIcon, Play, Trash2, Film, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  removeFromHistory,
  clearHistory,
  useWatchHistory,
  type HistoryEntry,
} from "../hooks/useSettings";
import { formatTimeAgo } from "../hooks/useCountdownTick";
import { XaniMascot } from "../components/XaniMascot";
import { ConfirmDialog } from "../components/ConfirmDialog";

interface GroupedHistory {
  animeId: number;
  title: string;
  coverImage: string;
  episodes: HistoryEntry[];
  latest: HistoryEntry;
}

function groupByAnime(history: HistoryEntry[]): GroupedHistory[] {
  const map = new Map<number, GroupedHistory>();
  for (const entry of history) {
    const existing = map.get(entry.animeId);
    if (existing) {
      existing.episodes.push(entry);
      if (entry.updatedAt > existing.latest.updatedAt) existing.latest = entry;
    } else {
      map.set(entry.animeId, {
        animeId: entry.animeId,
        title: entry.title,
        coverImage: entry.coverImage,
        episodes: [entry],
        latest: entry,
      });
    }
  }
  // Sort groups by latest updatedAt desc, and sort episodes within each group
  return Array.from(map.values())
    .map((g) => ({
      ...g,
      episodes: g.episodes.sort((a, b) => b.updatedAt - a.updatedAt),
    }))
    .sort((a, b) => b.latest.updatedAt - a.latest.updatedAt);
}


export function History() {
  const history = useWatchHistory();

  const grouped = useMemo(() => groupByAnime(history), [history]);

  // BUG 6 FIX: "Clear All" used to call window.confirm(), which modern
  // sandboxed iframes silently BLOCK (the button just did nothing) and
  // which looked jarring against the dark glass UI. A glassmorphic
  // <ConfirmDialog /> modal replaces it, and clearing now confirms with a
  // toast instead of silence.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-dismiss the confirmation toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const removeGroup = (animeId: number) => {
    for (const ep of history.filter((e) => e.animeId === animeId)) {
      removeFromHistory(animeId, ep.episode);
    }
  };

  const removeEpisode = (animeId: number, episode: number) => {
    removeFromHistory(animeId, episode);
  };

  const clearAll = () => {
    setConfirmOpen(true);
  };

  const handleConfirmClear = () => {
    clearHistory();
    setConfirmOpen(false);
    setToast("Watch history cleared");
  };

  if (!history) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl skeleton" />
          <div className="space-y-2">
            <div className="h-6 w-32 rounded skeleton" />
            <div className="h-3 w-48 rounded skeleton" />
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="glass rounded-xl p-4 flex items-center gap-4">
              <div className="w-12 h-16 rounded-lg skeleton" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded skeleton" />
                <div className="h-2 w-1/2 rounded skeleton" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center glow-crimson">
            <HistoryIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">History</h1>
            <p className="text-sm text-muted-foreground">
              {history.length === 0
                ? "No watch history yet"
                : `${grouped.length} anime • ${history.length} episode${history.length === 1 ? "" : "s"} watched`}
            </p>
          </div>
        </div>
        {history.length > 0 && (
          <button
            onClick={clearAll}
            className="btn-premium flex items-center gap-2 px-4 py-2 rounded-lg bg-xan-card border border-xan-border hover:border-xan-crimson/40 text-sm text-muted-foreground hover:text-xan-crimson transition-all"
          >
            <Trash2 className="h-4 w-4" /> Clear All
          </button>
        )}
      </div>

      {/* Empty state */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center border border-xan-border rounded-2xl bg-xan-card/30">
          <XaniMascot mood="sleepy" size={96} className="mb-4" />
          <p className="text-lg font-medium text-foreground">No history yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Start watching anime and your progress will appear here for quick resume.
          </p>
          <Link
            to="/home"
            className="btn-premium mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-violet font-semibold text-white shadow-lg shadow-xan-crimson/30"
          >
            <Play className="h-4 w-4 fill-white" /> Browse Anime
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((entry, i) => {
            const epCount = entry.episodes.length;
            return (
              <div
                key={entry.animeId}
                className="glass card-glow group rounded-xl overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              >
                <div className="flex items-stretch gap-3 p-3">
                  {/* Cover image */}
                  <Link
                    to={`/watch/${entry.animeId}?ep=${entry.latest.episode}`}
                    className="relative w-20 sm:w-24 aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0 group/cover"
                  >
                    <img
                      src={entry.coverImage || "/placeholder.svg"}
                      alt={entry.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover/cover:scale-105"
                      onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-xan-crimson/95 flex items-center justify-center pulse-glow">
                        <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    {/* Episode count badge */}
                    {epCount > 1 && (
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-black/80 backdrop-blur text-white">
                        <Film className="h-2.5 w-2.5" />
                        {epCount}
                      </div>
                    )}
                  </Link>

                  {/* Info + episode chips */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link
                          to={`/anime/${entry.animeId}`}
                          className="font-medium text-sm text-foreground line-clamp-1 hover:text-xan-crimson transition-colors"
                        >
                          {entry.title}
                        </Link>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Last watched {formatTimeAgo(entry.latest.updatedAt)} • EP {entry.latest.episode}
                        </p>
                      </div>
                      <button
                        onClick={() => removeGroup(entry.animeId)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-xan-crimson hover:bg-xan-card-hover transition-all flex-shrink-0"
                        title="Remove all episodes"
                        aria-label="Remove from history"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Episode chips (latest highlighted) */}
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {entry.episodes.slice(0, 8).map((ep, idx) => (
                        <Link
                          key={`${ep.animeId}-${ep.episode}`}
                          to={`/watch/${ep.animeId}?ep=${ep.episode}`}
                          title={`EP ${ep.episode} • ${formatTimeAgo(ep.updatedAt)}`}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
                            idx === 0
                              ? "bg-xan-crimson text-white shadow-[0_0_8px_rgba(233,69,96,0.5)]"
                              : "bg-xan-card text-muted-foreground hover:text-foreground hover:bg-xan-card-hover"
                          }`}
                        >
                          {idx === 0 && (
                            <span className="text-[8px] font-bold uppercase tracking-wide opacity-80">Last</span>
                          )}
                          EP {ep.episode}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              removeEpisode(ep.animeId, ep.episode);
                            }}
                            className="opacity-0 hover:opacity-100 -mr-1 ml-0.5 group-hover:opacity-50 hover:!opacity-100"
                            aria-label={`Remove episode ${ep.episode}`}
                          >
                            <Trash2 className="h-2.5 w-2.5" />
                          </button>
                        </Link>
                      ))}
                      {entry.episodes.length > 8 && (
                        <span className="text-[11px] text-muted-foreground ml-1">
                          +{entry.episodes.length - 8} more
                        </span>
                      )}
                    </div>

                    {/* Continue watching CTA */}
                    <Link
                      to={`/watch/${entry.animeId}?ep=${entry.latest.episode}`}
                      className="mt-auto pt-2 inline-flex items-center gap-1 text-xs text-xan-crimson hover:gap-2 transition-all w-fit"
                    >
                      Continue EP {entry.latest.episode}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BUG 6 FIX: glassmorphic confirmation dialog replaces window.confirm() */}
      <ConfirmDialog
        open={confirmOpen}
        title="Clear all watch history?"
        description="Every episode entry will be removed. This cannot be undone."
        confirmLabel="Clear All"
        destructive
        onConfirm={handleConfirmClear}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* BUG 6 FIX: confirmation toast after clearing */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-24 md:bottom-8 left-1/2 z-[110] -translate-x-1/2 animate-panel-up"
        >
          <div className="flex items-center gap-2 rounded-full glass-strong border border-xan-border px-4 py-2.5 text-sm font-medium text-foreground shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}
