import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  CalendarOff,
  Filter,
  Check,
} from "lucide-react";
import { fetchSchedule, getTitle, type AiringAnime } from "../lib/anilist";
import { useCountdownTick, formatCountdown } from "../hooks/useCountdownTick";
import { useBookmarks } from "../hooks/useBookmarks";
import { useAnimeList } from "../hooks/useAnimeList";
import { useWatchHistory } from "../hooks/useSettings";
import { EmptyState } from "../components/EmptyState";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

interface GroupedEntry {
  anime: AiringAnime;
  episodes: { episode: number; airingAt: number }[];
  latest: { episode: number; airingAt: number };
}

/** Get the Sunday of the week containing `date` (local time). */
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // back to Sunday
  return d;
}

/** Format a date as "Jul 14" style. */
function formatShortDate(d: Date): string {
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Format a date as "Mon, Jul 14" style. */
function formatFullDate(d: Date): string {
  const dayName = DAY_SHORT[d.getDay()];
  const dateStr = d.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${dayName}, ${dateStr}`;
}

export function Schedule() {
  const [anime, setAnime] = useState<AiringAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // activeDay is 0-6 (Sun-Sat) within the selected week
  const [activeDay, setActiveDay] = useState<number>(new Date().getDay());
  // weekOffset: 0 = current week, -1 = previous, +1 = next, etc.
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [onlySaved, setOnlySaved] = useState(false);
  const now = useCountdownTick();
  const { bookmarks } = useBookmarks();
  const { list: animeList } = useAnimeList();
  const history = useWatchHistory();

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

  // Compute the selected week's start (Sunday) and the 7 dates within it
  const weekStart = useMemo(
    () => {
      const base = startOfWeek(new Date());
      base.setDate(base.getDate() + weekOffset * 7);
      return base;
    },
    [weekOffset],
  );
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    }),
    [weekStart],
  );
  // weekEndInclusive = end of the last day (23:59:59.999) so the boundary
  // check `d <= weekEndInclusive` correctly includes episodes airing late
  // on the last day of the week (was `d > weekEnd` which excluded them
  // because weekEnd was at midnight 00:00:00).
  const weekEndInclusive = useMemo(() => {
    const d = new Date(weekDates[6]);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekDates]);

  // Determine if the selected week is the current week (contains today)
  const today = new Date(now);
  const todayWeekStart = startOfWeek(today);
  const isCurrentWeek = weekStart.getTime() === todayWeekStart.getTime();
  const isPastWeek = weekEndInclusive < todayWeekStart;
  const isFutureWeek = weekStart > todayWeekStart;

  // Group anime by day-of-week within the selected week.
  // For the CURRENT week, use the real nextAiringEpisode.airingAt.
  // For FUTURE weeks, project airing times forward by weekOffset weeks
  //   (most airing shows are weekly, so ep N+1 airs ~7 days after ep N).
  // For PAST weeks, project backward — these episodes have already aired.
  const byDay = useMemo(() => {
    const map: Record<number, Map<number, GroupedEntry>> = {};
    for (let i = 0; i < 7; i++) map[i] = new Map();
    for (const a of anime) {
      if (!a.nextAiringEpisode) continue;
      const realAiringAt = a.nextAiringEpisode.airingAt * 1000;
      // Project the airing time into the selected week
      const projectedAiringAt = realAiringAt + weekOffset * MS_PER_WEEK;
      const d = new Date(projectedAiringAt);
      const day = d.getDay();
      // Only include if the projected date actually falls in the selected week
      if (d < weekStart || d > weekEndInclusive) continue;
      const existing = map[day].get(a.id);
      const ep = { episode: a.nextAiringEpisode.episode + weekOffset, airingAt: projectedAiringAt };
      if (existing) {
        existing.episodes.push(ep);
        if (ep.airingAt > existing.latest.airingAt) existing.latest = ep;
      } else {
        map[day].set(a.id, { anime: a, episodes: [ep], latest: ep });
      }
    }
    return map;
  }, [anime, weekOffset, weekStart, weekEndInclusive]);

  const todayDay = new Date(now).getDay();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "local time";

  const activeEntries = Array.from(byDay[activeDay].values())
    .filter((e) => !onlySaved || savedIds.has(e.anime.id))
    .sort((a, b) => a.latest.airingAt - b.latest.airingAt);

  const savedCount = useMemo(() => {
    let n = 0;
    for (let i = 0; i < 7; i++) {
      for (const id of byDay[i].keys()) {
        if (savedIds.has(id)) n++;
      }
    }
    return n;
  }, [byDay, savedIds]);

  // Total shows this week (for header subtitle)
  const totalThisWeek = useMemo(() => {
    let n = 0;
    for (let i = 0; i < 7; i++) n += byDay[i].size;
    return n;
  }, [byDay]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  // Week label e.g. "Jul 14 – Jul 20" or "This Week" / "Next Week" / "Last Week"
  const weekLabel = isCurrentWeek
    ? "This Week"
    : isFutureWeek && weekOffset === 1
      ? "Next Week"
      : isPastWeek && weekOffset === -1
        ? "Last Week"
        : `${formatShortDate(weekStart)} – ${formatShortDate(weekDates[6])}`;

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center glow-crimson">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Schedule</h1>
            <p className="text-sm text-muted-foreground">
              {totalThisWeek > 0
                ? `${totalThisWeek} scheduled ${totalThisWeek === 1 ? "episode" : "episodes"} this week`
                : "Currently airing anime — next episodes"}
            </p>
          </div>
        </div>

        {/* Week navigator — prev / label / next + "Today" jump button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w - 1)}
            aria-label="Previous week"
            className="w-9 h-9 rounded-lg glass border border-xan-border hover:bg-xan-card-hover hover:border-xan-crimson/40 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="px-4 h-9 rounded-lg glass border border-xan-border flex items-center gap-2 min-w-[140px] justify-center">
            <Calendar className="h-3.5 w-3.5 text-xan-crimson" />
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">{weekLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setWeekOffset((w) => w + 1)}
            aria-label="Next week"
            className="w-9 h-9 rounded-lg glass border border-xan-border hover:bg-xan-card-hover hover:border-xan-crimson/40 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={() => {
                setWeekOffset(0);
                setActiveDay(new Date().getDay());
              }}
              className="ml-1 px-3 h-9 rounded-lg bg-xan-card border border-xan-border hover:border-xan-crimson/40 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Today
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4 sm:ml-13">
        {isPastWeek
          ? `Past schedule — ${formatShortDate(weekStart)} to ${formatShortDate(weekDates[6])} (already aired)`
          : isFutureWeek
            ? `Upcoming schedule — ${formatShortDate(weekStart)} to ${formatShortDate(weekDates[6])} (projected from current airing patterns)`
            : `Airing times in ${timezone}`}
      </p>

      {/* "Only show saved" toggle */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => setOnlySaved((v) => !v)}
          aria-pressed={onlySaved}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
            onlySaved
              ? "bg-xan-crimson/15 border-xan-crimson/50 text-xan-crimson"
              : "bg-xan-card border border-xan-border text-muted-foreground hover:text-foreground hover:border-xan-crimson/40"
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

        {/* Week range quick-jump — shows up to 5 weeks: -2, -1, 0, +1, +2 */}
        <div className="hidden sm:flex items-center gap-1">
          {[-2, -1, 0, 1, 2].map((offset) => {
            const d = new Date(weekStart);
            // Compute the Sunday for this offset relative to the CURRENT week
            const currentWeekStart = startOfWeek(new Date());
            const targetStart = new Date(currentWeekStart);
            targetStart.setDate(targetStart.getDate() + offset * 7);
            const targetEnd = new Date(targetStart);
            targetEnd.setDate(targetEnd.getDate() + 6);
            const isActive = offset === weekOffset;
            const label = offset === 0 ? "This" : offset === -1 ? "Last" : offset === 1 ? "Next" : formatShortDate(targetStart);
            return (
              <button
                key={offset}
                type="button"
                onClick={() => setWeekOffset(offset)}
                aria-current={isActive}
                className={`px-2.5 h-7 rounded-md text-[11px] font-medium transition-colors ${
                  isActive
                    ? "bg-gradient-to-br from-xan-crimson to-xan-violet text-white shadow-sm"
                    : "bg-xan-card text-muted-foreground hover:text-foreground hover:bg-xan-card-hover border border-xan-border"
                }`}
                title={`${formatShortDate(targetStart)} – ${formatShortDate(targetEnd)}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day-of-week tabs with actual dates */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 mb-6">
        {weekDates.map((date, idx) => {
          const dayIdx = date.getDay();
          const count = byDay[dayIdx].size;
          const isToday = isCurrentWeek && dayIdx === todayDay;
          const isActive = idx === activeDay;
          const isPast = date < today && !isToday;
          return (
            <button
              key={idx}
              onClick={() => setActiveDay(idx)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-0.5 min-w-[88px] ${
                isActive
                  ? "bg-gradient-to-br from-xan-crimson to-xan-violet text-white shadow-lg shadow-xan-crimson/20"
                  : isPast
                    ? "bg-xan-card/50 text-muted-foreground/60 hover:text-muted-foreground hover:bg-xan-card border border-xan-border/50"
                    : "bg-xan-card text-muted-foreground hover:text-foreground hover:bg-xan-card-hover border border-xan-border"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {DAY_SHORT[dayIdx]}
                <span className={`text-[11px] ${isActive ? "text-white/90" : "text-muted-foreground/80"}`}>
                  {date.getDate()}
                </span>
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

      {/* Active day label */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
        <h2 className="text-lg font-bold font-display text-foreground">
          {formatFullDate(weekDates[activeDay])}
        </h2>
        {isPastWeek && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-green-500/15 text-green-500 border border-green-500/30">
            Aired
          </span>
        )}
        {isFutureWeek && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-xan-crimson/15 text-xan-crimson border border-xan-crimson/30">
            Upcoming
          </span>
        )}
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
              : isPastWeek
                ? "No episodes were scheduled this day in the selected week."
                : isFutureWeek
                  ? "No episodes projected for this day. Most airing shows follow weekly patterns — try the current week for accurate data."
                  : `Try another day — there are ${totalThisWeek} scheduled episodes this week.`
          }
          actionLabel={onlySaved ? "Show all scheduled" : undefined}
          onAction={onlySaved ? () => setOnlySaved(false) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-fade-in-up">
          {activeEntries.map((entry) => (
            <ScheduleCard
              key={entry.anime.id}
              entry={entry}
              now={now}
              isPastWeek={isPastWeek}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScheduleCard({
  entry,
  now,
  isPastWeek,
}: {
  entry: GroupedEntry;
  now: number;
  isPastWeek: boolean;
}) {
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
          {isPastWeek || isAired ? (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-xs font-bold uppercase text-green-500">Aired</span>
            </>
          ) : isImminent ? (
            <>
              <Clock className="h-3 w-3 text-xan-crimson animate-pulse" />
              <span className="text-xs font-mono font-bold text-xan-crimson animate-pulse">
                {formatCountdown(Math.floor(msLeft / 1000))}
              </span>
            </>
          ) : (
            <>
              <Clock className="h-3 w-3 text-xan-crimson" />
              <span className="text-xs font-mono font-medium text-muted-foreground">
                {formatCountdown(Math.floor(msLeft / 1000))}
              </span>
            </>
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
