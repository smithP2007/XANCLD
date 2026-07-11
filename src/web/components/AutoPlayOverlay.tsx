import { useState, useEffect, useRef } from "react";
import { Play, X } from "lucide-react";

interface Props {
  open: boolean;
  onCancel: () => void;
  onPlayNow: () => void;
  /** Episode title for display */
  nextEpisodeLabel?: string;
}

const COUNTDOWN_SECONDS = 10;

export function AutoPlayOverlay({ open, onCancel, onPlayNow, nextEpisodeLabel }: Props) {
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) {
      setRemaining(COUNTDOWN_SECONDS);
      return;
    }
    setRemaining(COUNTDOWN_SECONDS);
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          onPlayNow();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, onPlayNow]);

  if (!open) return null;

  // Circular progress ring
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (remaining / COUNTDOWN_SECONDS) * circumference;

  return (
    <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in">
      <div className="max-w-md w-full glass-strong rounded-2xl p-8 border border-white/10 text-center">
        <p className="text-xs uppercase tracking-wider text-white/50 font-semibold mb-1">
          Up Next
        </p>
        {nextEpisodeLabel && (
          <p className="text-lg font-bold text-white mb-6 line-clamp-2">{nextEpisodeLabel}</p>
        )}
        {!nextEpisodeLabel && <div className="mb-6" />}

        {/* Countdown ring */}
        <div className="relative w-20 h-20 mx-auto mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="4"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="var(--color-xan-crimson)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-white font-mono">
            {remaining}
          </span>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onPlayNow}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-xan-crimson to-xan-violet text-white text-sm font-semibold shadow-lg shadow-xan-crimson/30 hover:opacity-90 transition-opacity"
          >
            <Play className="h-4 w-4 fill-white" />
            Play Now
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full glass text-white/80 text-sm font-semibold border border-white/15 hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
