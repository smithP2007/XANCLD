import { Dices, Play, Bookmark, Clapperboard, CalendarDays } from "lucide-react";

interface Props {
  inProgress: number;
  saved: number;
  episodes: number;
  onSurprise: () => void;
  shuffling: boolean;
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Late night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// v4.4 ENGAGING — a personal, time-aware opener for the Home feed.
// • "Good evening." greets by wall-clock hour (late-night regulars get their
//   own line — the 1am anime crowd deserves it)
// • One glanceable stats line: shows in progress, saved bookmarks, episodes
//   watched — all live from local state, so it updates the moment you watch
//   or save something
// • "Surprise Me" rolls a random pick out of the trending + popular pools
//   (dice does a little shuffle dance for ~0.5s before Home navigates)
export function HomeGreeting({ inProgress, saved, episodes, onSurprise, shuffling }: Props) {
  const hour = new Date().getHours();
  const greeting = greetingFor(hour);
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const hasActivity = inProgress > 0 || saved > 0 || episodes > 0;

  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-5">
      <div className="min-w-0">
        {/* Date eyebrow */}
        <p
          className="animate-greet-in flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-muted-foreground"
          style={{ animationDelay: "0ms" }}
        >
          <CalendarDays className="h-3.5 w-3.5 text-xan-crimson" />
          {dateStr}
        </p>

        {/* Time-aware greeting — the daypart word gets the signature gradient */}
        <h1
          className="animate-greet-in mt-1.5 font-display text-[28px] font-extrabold leading-tight tracking-tight text-foreground md:text-4xl"
          style={{ animationDelay: "70ms" }}
        >
          {greeting}{" "}
          <span className="bg-gradient-to-r from-xan-crimson via-xan-crimson to-xan-violet bg-clip-text text-transparent">
            anime fan
          </span>
          .
        </h1>

        {/* Live personal stats */}
        <p
          className="animate-greet-in mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] font-semibold text-muted-foreground"
          style={{ animationDelay: "140ms" }}
        >
          {hasActivity ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <Play className="h-3.5 w-3.5 fill-xan-crimson text-xan-crimson" />
                <b className="tabular-nums text-foreground">{inProgress}</b> in progress
              </span>
              <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/50" />
              <span className="inline-flex items-center gap-1.5">
                <Bookmark className="h-3.5 w-3.5 text-xan-crimson" />
                <b className="tabular-nums text-foreground">{saved}</b> saved
              </span>
              <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/50" />
              <span className="inline-flex items-center gap-1.5">
                <Clapperboard className="h-3.5 w-3.5 text-xan-crimson" />
                <b className="tabular-nums text-foreground">{episodes}</b>{" "}
                {episodes === 1 ? "episode" : "episodes"} watched
              </span>
            </>
          ) : (
            "Your feed is ready — press play on anything to personalize it."
          )}
        </p>
      </div>

      {/* Surprise Me — random pick from the trending/popular pools */}
      <button
        type="button"
        onClick={onSurprise}
        disabled={shuffling}
        className="animate-greet-in group/surprise inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-xan-crimson to-xan-violet px-4 py-2.5 text-[13px] font-extrabold text-white shadow-[0_8px_28px_rgba(233,69,96,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(233,69,96,0.5)] active:translate-y-0 disabled:cursor-wait"
        style={{ animationDelay: "210ms" }}
      >
        <Dices className={`h-4 w-4 ${shuffling ? "animate-dice" : "transition-transform duration-300 group-hover/surprise:rotate-12"}`} />
        {shuffling ? "Rolling…" : "Surprise Me"}
      </button>
    </div>
  );
}
