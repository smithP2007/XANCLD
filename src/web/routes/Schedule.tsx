import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, AlertCircle, ChevronLeft, ChevronRight, CalendarOff, Filter } from "lucide-react";
import { fetchSchedule, getTitle, type AiringAnime } from "../lib/anilist";
import { useCountdownTick, formatCountdown } from "../hooks/useCountdownTick";
import { useBookmarks } from "../hooks/useBookmarks";
import { useAnimeList } from "../hooks/useAnimeList";
import { useWatchHistory } from "../hooks/useSettings";
import { EmptyState } from "../components/EmptyState";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface GroupedEntry {
  anime: AiringAnime;
  episodes: { episode: number; airingAt: number }[];
  latest: { episode: number; airingAt: number };
}

export function Schedule() {
  const [anime, setAnime] = useState<AiringAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<number>(new Date().getDay());
  // "Only show saved/recently watched" toggle (redesign plan §4) — purely
  // client-side filter against bookmarks + animelist + watch history.
  const [onlySaved, setOnlySaved] = useState(false);
  const now = useCountdownTick();
  const { bookmarks } = useBookmarks();
  const { list: animeList } = useAnimeList();
  const history = useWatchHistory();

  // Build a Set of anime IDs the user has saved/watched/bookmarked
  const savedIds = useMemo(() => {
    const ids = new Set<number>();
    bookmarks.forEach((b) => ids.add(b.animeId));
    animeList.forEach((e) => ids.add(e.animeId));
    history.forEach((h) => ids.add(h.animeId));
    return ids;
  }, [bookmarks, animeList, history]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSchedule(50);
        setAnime(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Group by day-of-week, then by anime within each day
  const byDay = useMemo(() => {
    const map: Record<number, Map<number, GroupedEntry>> = {};
    for (let i = 0; i < 7; i++) map[i] = new Map();
    for (const a of anime) {
      if (!a.nextAiringEpisode) continue;
      const airingAt = a.nextAiringEpisode.airingAt * 1000;
      const day = new Date(airingAt).getDay();
      const existing = map[day].get(a.id);
      const ep = { episode: a.nextAiringEpisode.episode, airingAt };
      if (existing) {
        existing.episodes.push(ep);
        if (ep.airingAt > existing.latest.airingAt) existing.latest = ep;
      } else {
        map[day].set(a.id, { anime: a, episodes: [ep], latest: ep });
      }
    }
    return map;
  }, [anime]);

  const todayDay = new Date(now).getDay();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";

  // Sort within active day by latest airing time. When onlySaved is on,
  // filter to entries whose anime ID appears in bookmarks/animelist/history.
  const activeEntries = Array.from(byDay[activeDay].values())
    .filter((e) => !onlySaved || savedIds.has(e.anime.id))
    .sort((a, b) => a.latest.airingAt - b.latest.airingAt);

  // Count of saved shows across all days (for the toggle's badge)
  const savedCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < 7; i++) {
      for (const id of byDay[i].keys()) {
        if (savedIds.has(id)) n++;
      }
    }
    return n;
  }, [byDay, savedIds]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center glow-crimson">
          <Calendar className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground">Currently airing anime — next episodes</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4 ml-13">
        Airing times in {timezone}
      </p>

      {/* "Only show saved" toggle (redesign plan §4) */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => setOnlySaved((v) => !v)}
          aria-pressed={onlySaved}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            onlySaved
              ? "bg-xan-crimson/15 border-xan-crimson/50 text-xan-crimson"
              : "bg-xan-card border-xan-border text-muted-foreground hover:text-foreground hover:border-xan-crimson/40"
          }`}
        >
          <Filter className="h-3.5 w-3.5" />
          {onlySaved ? "Showing saved only" : "Only show saved"}
          {savedCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                onlySaved ? "bg-xan-crimson/20 text-xan-crimson" : "bg-xan-card-hover text-muted-foreground"
              }`}
            >
              {savedCount}
            </span>
          )}
        </button>
      </div>

      {/* Day-of-week tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-6">
        {DAY_NAMES.map((day, idx) => {
          const count = byDay[idx].size;
          const isToday = idx === todayDay;
          const isActive = idx === activeDay;
          return (
            <button
              key={day}
              onClick={() => setActiveDay(idx)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-0.5 min-w-[80px] ${
                isActive
                  ? "bg-gradient-to-br from-xan-crimson to-xan-violet text-white shadow-lg shadow-xan-crimson/20"
                  : "bg-xan-card text-muted-foreground hover:text-foreground hover:bg-xan-card-hover border border-xan-border"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {DAY_SHORT[idx]}
                {isToday && (
                  <span
                    className={`px-1 py-0.5 rounded text-[8px] font-bold uppercase ${
                      isActive ? "bg-white/20 text-white" : "bg-xan-crimson/20 text-xan-crimson"
                    }`}
                  >
                    Today
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] ${isActive ? "text-white/80" : "text-muted-foreground/70"}`}
              >
                {count} {count === 1 ? "show" : "shows"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active day entries */}
      {activeEntries.length === 0 ? (
        <EmptyState
          mascotMood="sleepy"
          title={onlySaved ? "No saved shows airing this day" : "Nothing airing this day"}
          description={
            onlySaved
              ? savedCount === 0
                ? "Bookmark or watch anime to see them filtered here. Toggle off to see all scheduled shows."
                : "Try another day, or toggle off the filter to see all scheduled shows."
              : `Try another day — there are ${anime.length} scheduled episodes this week.`
          }
          actionLabel={onlySaved ? "Show all scheduled" : undefined}
          onAction={onlySaved ? () => setOnlySaved(false) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in-up">
          {activeEntries.map((entry) => (
            <ScheduleCard key={entry.anime.id} entry={entry} now={now} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleCard({ entry, now }: { entry: GroupedEntry; now: number }) {
  const { anime, latest, episodes } = entry;
  const airingAtMs = latest.airingAt;
  const msLeft = airingAtMs - now;
  const isAired = msLeft <= 0;
  const isImminent = msLeft > 0 && msLeft < 3600000; // <1h

  const dateLabel = new Date(airingAtMs).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Link
      to={`/anime/${anime.id}`}
      className="glass card-glow group flex items-center gap-3 p-3 rounded-xl hover:border-xan-crimson/30 transition-all"
    >
      <div className="relative shrink-0">
        <img
          src={anime.coverImage.large}
          alt={getTitle(anime.title)}
          loading="lazy"
          className="w-14 h-20 rounded-lg object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
        />
        {episodes.length > 1 && (
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-xan-crimson text-white shadow">
            {episodes.length} eps
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-sm text-foreground line-clamp-1 group-hover:text-xan-crimson transition-colors">
          {getTitle(anime.title)}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Episode {latest.episode} • {dateLabel}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Clock
            className={`h-3 w-3 ${
              isImminent ? "text-xan-crimson animate-pulse" : isAired ? "text-green-500" : "text-xan-crimson"
            }`}
          />
          {isAired ? (
            <span className="text-xs font-bold uppercase text-green-500">Aired</span>
          ) : isImminent ? (
            <span className="text-xs font-mono font-bold text-xan-crimson animate-pulse">
              {formatCountdown(Math.floor(msLeft / 1000))}
            </span>
          ) : (
            <span className="text-xs font-mono font-medium text-muted-foreground">
              {formatCountdown(Math.floor(msLeft / 1000))}
            </span>
          )}
        </div>
      </div>
    </Link>
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
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="w-20 h-14 rounded-xl skeleton" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="glass rounded-xl p-3 flex items-center gap-3">
            <div className="w-14 h-20 rounded-lg skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-3/4 rounded skeleton" />
              <div className="h-2 w-1/2 rounded skeleton" />
              <div className="h-2 w-1/3 rounded skeleton" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <AlertCircle className="h-10 w-10 text-xan-crimson mb-3" />
      <p className="text-lg font-medium">Failed to load schedule</p>
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
