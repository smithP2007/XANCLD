import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Library,
  Bookmark,
  Eye,
  Check,
  Clock,
  Pause,
  X,
  Trash2,
  Play,
  Star,
  AlertCircle,
  Grid3x3,
  List as ListIcon,
} from "lucide-react";
import { useBookmarks } from "../hooks/useBookmarks";
import {
  useAnimeList,
  type AnimeStatus,
  STATUS_LABELS,
  STATUS_ORDER,
} from "../hooks/useAnimeList";

type Tab = "all" | AnimeStatus | "bookmarks";

export function MyLibrary() {
  const [tab, setTab] = useState<Tab>("bookmarks");
  const [view, setView] = useState<"grid" | "list">("grid");
  const { bookmarks, removeBookmark, clearBookmarks } = useBookmarks();
  const { list, remove, clearAll } = useAnimeList();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.length, bookmarks: bookmarks.length };
    for (const s of STATUS_ORDER) c[s] = list.filter((e) => e.status === s).length;
    return c;
  }, [list, bookmarks]);

  // Filter by active tab
  const filtered = useMemo(() => {
    if (tab === "all") return list;
    if (tab === "bookmarks") return [];
    return list.filter((e) => e.status === tab);
  }, [tab, list]);

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "all", label: "All", icon: Library },
    { id: "WATCHING", label: "Watching", icon: Eye },
    { id: "COMPLETED", label: "Completed", icon: Check },
    { id: "PLANNING", label: "Plan to Watch", icon: Clock },
    { id: "ON_HOLD", label: "On Hold", icon: Pause },
    { id: "DROPPED", label: "Dropped", icon: X },
    { id: "bookmarks", label: "Bookmarks", icon: Bookmark },
  ];

  const handleClearAll = () => {
    if (tab === "bookmarks") {
      if (confirm("Remove all bookmarks? This cannot be undone.")) clearBookmarks();
    } else {
      if (confirm("Clear entire anime list? This cannot be undone.")) clearAll();
    }
  };

  const handleRemove = (animeId: number) => {
    if (tab === "bookmarks") removeBookmark(animeId);
    else remove(animeId);
  };

  const isEmpty = (tab === "bookmarks" ? bookmarks : filtered).length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center glow-crimson">
            <Library className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">My Library</h1>
            <p className="text-sm text-muted-foreground">
              {list.length + bookmarks.length} anime across your lists and bookmarks
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-xan-card border border-xan-border">
            <button
              onClick={() => setView("grid")}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                view === "grid" ? "bg-xan-crimson text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Grid view"
            >
              <Grid3x3 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                view === "list" ? "bg-xan-crimson text-white" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="List view"
            >
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          {(list.length > 0 || bookmarks.length > 0) && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-xan-card border border-xan-border hover:border-xan-crimson/40 text-sm text-muted-foreground hover:text-xan-crimson transition-all"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clear {tab === "bookmarks" ? "Bookmarks" : "List"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-6">
        {TABS.map((t) => {
          const count = counts[t.id] ?? 0;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white shadow-lg shadow-xan-crimson/20"
                  : "bg-xan-card text-muted-foreground hover:text-foreground hover:bg-xan-card-hover border border-xan-border"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  isActive ? "bg-white/20" : "bg-xan-card-hover"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-32 text-center border border-xan-border rounded-2xl bg-xan-card/30">
          {tab === "bookmarks" ? (
            <Bookmark className="h-12 w-12 text-muted-foreground mb-3" />
          ) : (
            <Library className="h-12 w-12 text-muted-foreground mb-3" />
          )}
          <p className="text-lg font-medium text-foreground">
            {tab === "all"
              ? "Your library is empty"
              : tab === "bookmarks"
                ? "No bookmarks yet"
                : `No anime in "${STATUS_LABELS[tab as AnimeStatus]}"`}
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {tab === "bookmarks"
              ? "Bookmark anime from any card or detail page to save them for later."
              : tab === "all"
                ? "Add anime to your lists from any detail page using the 'Add to List' button."
                : `Browse anime and add it to your "${STATUS_LABELS[tab as AnimeStatus]}" list from its detail page.`}
          </p>
          <Link
            to="/home"
            className="btn-premium mt-6 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-violet font-semibold text-white shadow-lg shadow-xan-crimson/30"
          >
            <Play className="h-4 w-4 fill-white" /> Browse Anime
          </Link>
        </div>
      ) : tab === "bookmarks" ? (
        // Bookmarks view (grid only, like AnimeCard grid)
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-fade-in-up">
          {bookmarks.map((b, i) => (
            <div key={b.animeId} className="group relative card-enter" style={{ "--card-index": i } as React.CSSProperties}>
              <Link to={`/anime/${b.animeId}`} className="block">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-xan-card border border-xan-border transition-all duration-300 group-hover:border-xan-crimson/40 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
                  <img
                    src={b.coverImage || "/placeholder.svg"}
                    alt={b.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => ((e.target as HTMLImageElement).src = "/placeholder.svg")}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-xan-crimson/90 backdrop-blur-sm flex items-center justify-center shadow-lg scale-90 group-hover:scale-100 transition-transform">
                      <Play className="h-5 w-5 text-white fill-white ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <h3 className="font-medium text-sm text-white line-clamp-2 leading-snug">{b.title}</h3>
                  </div>
                </div>
              </Link>
              <button
                onClick={() => removeBookmark(b.animeId)}
                className="absolute top-1.5 right-1.5 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/70 hover:text-xan-crimson hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all"
                aria-label="Remove bookmark"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : view === "grid" ? (
        // List grid view
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-fade-in-up">
          {filtered.map((entry, i) => (
            <ListCard
              key={entry.animeId}
              entry={entry}
              index={i}
              onRemove={() => handleRemove(entry.animeId)}
            />
          ))}
        </div>
      ) : (
        // List view (rows)
        <div className="space-y-2 animate-fade-in-up">
          {filtered.map((entry, i) => (
            <ListRowItem
              key={entry.animeId}
              entry={entry}
              index={i}
              onRemove={() => handleRemove(entry.animeId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ListCard({
  entry,
  index,
  onRemove,
}: {
  entry: import("../hooks/useAnimeList").ListEntry;
  index: number;
  onRemove: () => void;
}) {
  const StatusIcon = {
    WATCHING: Eye,
    COMPLETED: Check,
    PLANNING: Clock,
    ON_HOLD: Pause,
    DROPPED: X,
  }[entry.status];
  const statusColor = {
    WATCHING: "bg-green-500",
    COMPLETED: "bg-blue-500",
    PLANNING: "bg-yellow-500",
    ON_HOLD: "bg-orange-500",
    DROPPED: "bg-red-500",
  }[entry.status];

  return (
    <div
      className="group relative card-enter"
      style={{ "--card-index": index } as React.CSSProperties}
    >
      <Link to={`/anime/${entry.animeId}`} className="block">
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-xan-card border border-xan-border transition-all duration-300 group-hover:border-xan-crimson/40 group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          <img
            src={entry.coverImage || "/placeholder.svg"}
            alt={entry.title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => ((e.target as HTMLImageElement).src = "/placeholder.svg")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />
          {/* Status badge */}
          <div className={`absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${statusColor}`}>
            <StatusIcon className="h-2.5 w-2.5" />
            {STATUS_LABELS[entry.status]}
          </div>
          {/* Score badge */}
          {entry.score != null && (
            <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/70 backdrop-blur text-white">
              <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
              {entry.score}
            </div>
          )}
          {/* Bottom content */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-medium text-sm text-white line-clamp-2 leading-snug">{entry.title}</h3>
            {entry.progress != null && (
              <p className="text-[11px] text-white/60 mt-1">EP {entry.progress}</p>
            )}
          </div>
        </div>
      </Link>
      <button
        onClick={onRemove}
        className="absolute top-1.5 right-1.5 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/70 hover:text-xan-crimson hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all"
        aria-label="Remove from list"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ListRowItem({
  entry,
  index,
  onRemove,
}: {
  entry: import("../hooks/useAnimeList").ListEntry;
  index: number;
  onRemove: () => void;
}) {
  const StatusIcon = {
    WATCHING: Eye,
    COMPLETED: Check,
    PLANNING: Clock,
    ON_HOLD: Pause,
    DROPPED: X,
  }[entry.status];
  const statusColor = {
    WATCHING: "text-green-500 bg-green-500/15",
    COMPLETED: "text-blue-500 bg-blue-500/15",
    PLANNING: "text-yellow-500 bg-yellow-500/15",
    ON_HOLD: "text-orange-500 bg-orange-500/15",
    DROPPED: "text-red-500 bg-red-500/15",
  }[entry.status];

  return (
    <div
      className="glass card-glow group rounded-xl flex items-center gap-3 p-3 animate-fade-in-up"
      style={{ animationDelay: `${Math.min(index * 30, 400)}ms` }}
    >
      <Link
        to={`/anime/${entry.animeId}`}
        className="relative w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 group/cover"
      >
        <img
          src={entry.coverImage || "/placeholder.svg"}
          alt={entry.title}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
        />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          to={`/anime/${entry.animeId}`}
          className="font-medium text-sm text-foreground line-clamp-1 hover:text-xan-crimson transition-colors"
        >
          {entry.title}
        </Link>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor}`}
          >
            <StatusIcon className="h-2.5 w-2.5" />
            {STATUS_LABELS[entry.status]}
          </span>
          {entry.progress != null && (
            <span className="text-[11px] text-muted-foreground">EP {entry.progress}</span>
          )}
          {entry.score != null && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
              {entry.score}/10
            </span>
          )}
        </div>
      </div>
      <Link
        to={`/anime/${entry.animeId}`}
        className="hidden sm:inline-flex items-center gap-1 text-xs text-xan-crimson hover:gap-2 transition-all w-fit"
      >
        View
        <Play className="h-3 w-3 fill-current" />
      </Link>
      <button
        onClick={onRemove}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-xan-crimson hover:bg-xan-card-hover transition-all flex-shrink-0"
        title="Remove from list"
        aria-label="Remove from list"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
