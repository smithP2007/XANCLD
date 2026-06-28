import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, Loader2, AlertCircle, Play } from "lucide-react";
import { fetchSchedule, getTitle, type AiringAnime } from "../lib/anilist";

export function Schedule() {
  const [anime, setAnime] = useState<AiringAnime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  // Tick every second for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchSchedule(30);
        setAnime(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;

  // Group by day
  const today = new Date(now);
  const days: Record<string, AiringAnime[]> = {};
  for (const a of anime) {
    const airingAt = a.nextAiringEpisode!.airingAt * 1000;
    const date = new Date(airingAt);
    const dayKey = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    if (!days[dayKey]) days[dayKey] = [];
    days[dayKey].push(a);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center glow-crimson">
          <Calendar className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground">Currently airing anime — next episodes</p>
        </div>
      </div>

      <div className="space-y-8">
        {Object.entries(days).map(([dayKey, items]) => (
          <div key={dayKey} className="animate-fade-in-up">
            <h2 className="text-lg font-bold font-display text-foreground mb-3 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
              {dayKey}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((a) => {
                const airingAt = a.nextAiringEpisode!.airingAt * 1000;
                const msLeft = airingAt - now;
                const isAired = msLeft <= 0;
                return (
                  <Link
                    key={a.id}
                    to={`/anime/${a.id}`}
                    className="glass card-glow group flex items-center gap-3 p-3 rounded-xl hover:border-xan-crimson/30 transition-all"
                  >
                    <img
                      src={a.coverImage.large}
                      alt={getTitle(a.title)}
                      className="w-12 h-16 rounded-lg object-cover shrink-0"
                      onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm text-foreground line-clamp-1 group-hover:text-xan-crimson transition-colors">
                        {getTitle(a.title)}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Episode {a.nextAiringEpisode!.episode}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Clock className="h-3 w-3 text-xan-crimson" />
                        <span
                          className={`text-xs font-mono font-medium ${
                            isAired ? "text-muted-foreground" : "text-xan-crimson"
                          }`}
                        >
                          {isAired ? "Aired" : formatCountdown(msLeft)}
                        </span>
                      </div>
                    </div>
                    <Play className="h-4 w-4 text-muted-foreground group-hover:text-xan-crimson transition-colors shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Now";
  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
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
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-xan-crimson" />
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
    </div>
  );
}
