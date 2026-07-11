import { useState, useRef, useEffect } from "react";
import {
  Plus,
  Eye,
  Check,
  Clock,
  Pause,
  X,
  ChevronDown,
} from "lucide-react";
import { useAnimeList, type AnimeStatus, STATUS_LABELS, STATUS_ORDER } from "../hooks/useAnimeList";

interface Props {
  animeId: number;
  title: string;
  coverImage: string;
  size?: "sm" | "md" | "lg";
}

const STATUS_ICONS: Record<AnimeStatus, React.ComponentType<{ className?: string }>> = {
  WATCHING: Eye,
  COMPLETED: Check,
  PLANNING: Clock,
  ON_HOLD: Pause,
  DROPPED: X,
};

const STATUS_COLORS: Record<AnimeStatus, string> = {
  WATCHING: "text-green-500",
  COMPLETED: "text-blue-500",
  PLANNING: "text-yellow-500",
  ON_HOLD: "text-orange-500",
  DROPPED: "text-red-500",
};

export function AnimeStatusButton({ animeId, title, coverImage, size = "md" }: Props) {
  const { getStatus, setStatus, remove } = useAnimeList();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentStatus = getStatus(animeId);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const sizeClasses =
    size === "sm" ? "h-8 px-3 text-xs" : size === "lg" ? "h-12 px-6 text-base" : "h-10 px-4 text-sm";

  const CurrentIcon = currentStatus ? STATUS_ICONS[currentStatus] : Plus;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 ${sizeClasses} rounded-xl glass border transition-all hover-lift ${
          currentStatus
            ? `border-xan-crimson/50 ${STATUS_COLORS[currentStatus]}`
            : "border-xan-border text-muted-foreground hover:text-foreground hover:border-xan-crimson/40"
        }`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <CurrentIcon className="h-4 w-4" />
        <span className="font-medium">
          {currentStatus ? STATUS_LABELS[currentStatus] : "Add to List"}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl p-1.5 z-30 animate-panel-up shadow-[0_12px_40px_rgba(0,0,0,0.6)] border border-xan-border bg-popover/95 backdrop-blur-xl">
          {STATUS_ORDER.map((status) => {
            const Icon = STATUS_ICONS[status];
            const isActive = currentStatus === status;
            return (
              <button
                key={status}
                onClick={() => {
                  if (isActive) {
                    // Clicking the active status removes it
                    remove(animeId);
                  } else {
                    setStatus(animeId, title, coverImage, status);
                  }
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-xan-crimson/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-xan-card-hover"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? STATUS_COLORS[status] : ""}`} />
                <span className="flex-1 text-left font-medium">{STATUS_LABELS[status]}</span>
                {isActive && <Check className="h-3.5 w-3.5 text-xan-crimson" />}
              </button>
            );
          })}
          {currentStatus && (
            <>
              <div className="my-1 h-px bg-xan-border" />
              <button
                onClick={() => {
                  remove(animeId);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
              >
                <X className="h-4 w-4" />
                <span className="font-medium">Remove from list</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
