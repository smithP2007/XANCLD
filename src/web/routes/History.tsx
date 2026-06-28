import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { History as HistoryIcon, Play, Trash2, X } from "lucide-react";
import {
  getHistory,
  removeFromHistory,
  clearHistory,
  type HistoryEntry,
} from "../hooks/useSettings";

export function History() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEntries(getHistory().sort((a, b) => b.updatedAt - a.updatedAt));
    setLoaded(true);
  }, []);

  const removeEntry = (animeId: number, episode: number) => {
    removeFromHistory(animeId, episode);
    setEntries(getHistory().sort((a, b) => b.updatedAt - a.updatedAt));
  };

  const clearAll = () => {
    if (confirm("Clear all watch history? This cannot be undone.")) {
      clearHistory();
      setEntries([]);
    }
  };

  if (!loaded) {
    return (
      <div className="flex justify-center py-32">
        <div className="animate-spin h-8 w-8 border-2 border-xan-crimson border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center glow-crimson">
            <HistoryIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">History</h1>
            <p className="text-sm text-muted-foreground">
              {entries.length === 0 ? "No watch history yet" : `${entries.length} episode${entries.length === 1 ? "" : "s"} watched`}
            </p>
          </div>
        </div>
        {entries.length > 0 && (
          <button
            onClick={clearAll}
            className="btn-premium flex items-center gap-2 px-4 py-2 rounded-lg bg-xan-card border border-xan-border hover:border-xan-crimson/40 text-sm text-muted-foreground hover:text-xan-crimson transition-all"
          >
            <Trash2 className="h-4 w-4" /> Clear All
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-20 h-20 rounded-full bg-xan-card flex items-center justify-center mb-4">
            <HistoryIcon className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground">No history yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Start watching anime and your progress will appear here for quick resume.
          </p>
          <Link
            to="/home"
            className="btn-premium mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-crimson-dark font-semibold text-white shadow-lg shadow-xan-crimson/30"
          >
            <Play className="h-4 w-4 fill-white" /> Browse Anime
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {entries.map((entry, i) => {
            const progress = entry.duration > 0 ? (entry.timestamp / entry.duration) * 100 : 0;
            return (
              <div
                key={`${entry.animeId}-${entry.episode}`}
                className="glass card-glow group relative rounded-xl overflow-hidden animate-fade-in-up"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <Link to={`/watch/${entry.animeId}?ep=${entry.episode}`} className="block">
                  <div className="relative aspect-video bg-xan-card">
                    <img
                      src={entry.coverImage}
                      alt={entry.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    {/* Play button overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-14 h-14 rounded-full bg-xan-crimson/90 backdrop-blur flex items-center justify-center pulse-glow">
                        <Play className="h-6 w-6 text-white fill-white ml-0.5" />
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                      <div
                        className="h-full bg-gradient-to-r from-xan-crimson to-xan-violet"
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    {/* Episode badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur text-xs font-medium text-white">
                      EP {entry.episode}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-foreground line-clamp-1 group-hover:text-xan-crimson transition-colors">
                      {entry.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatTime(entry.timestamp)} / {formatTime(entry.duration)}
                    </p>
                  </div>
                </Link>
                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    removeEntry(entry.animeId, entry.episode);
                  }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/80 backdrop-blur flex items-center justify-center text-white/70 hover:text-xan-crimson opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTime(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
