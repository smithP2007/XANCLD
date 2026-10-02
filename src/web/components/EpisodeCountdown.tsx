import { useCountdownTick } from "../hooks/useCountdownTick";

interface Props {
  episode: number;
  airingAt: number; // unix seconds
}

function formatRemaining(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

// v4.4 ENGAGING — live countdown chip overlaid on "Airing Today" cards.
// Reads the SHARED one-second tick (useCountdownTick — one global interval
// for every subscriber, with visibility/focus wake pokes) so a row of a
// dozen chips costs a single interval, not twelve. Within one hour of air
// the chip turns crimson and pulses; once the timestamp passes it flips to
// "Airing now".
export function EpisodeCountdown({ episode, airingAt }: Props) {
  const now = useCountdownTick();
  const remainingMs = airingAt * 1000 - now;
  const soon = remainingMs > 0 && remainingMs <= 60 * 60 * 1000;

  return (
    <div
      className={`pointer-events-none absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md transition-colors duration-500 ${
        soon
          ? "border-xan-crimson bg-xan-crimson/90 text-white shadow-[0_4px_18px_rgba(233,69,96,0.55)]"
          : "border-white/15 bg-black/60 text-white/90"
      }`}
    >
      <span className="relative flex h-1.5 w-1.5">
        {soon && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        )}
        <span
          className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
            soon ? "bg-white" : "bg-emerald-400"
          }`}
        />
      </span>
      <span>EP {episode}</span>
      <span className="opacity-50">·</span>
      <span className="tabular-nums">
        {remainingMs <= 0 ? "Airing now" : `in ${formatRemaining(remainingMs)}`}
      </span>
    </div>
  );
}
