import type { ReactNode } from "react";
import { Search, Sparkles } from "lucide-react";
import { XaniMascot, type MascotMood } from "./XaniMascot";

interface Props {
  /** Optional icon node. When provided, overrides the mascot. */
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Optional primary action (e.g. "Surprise Me" button). */
  actionLabel?: string;
  onAction?: () => void;
  /** Optional secondary action. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Compact variant for inline use (smaller padding). */
  compact?: boolean;
  /**
   * Mascot mood. Per the redesign plan §3, the Xani mascot appears ONLY in
   * empty/error states. Default "happy". Set to "sleepy" for empty history,
   * "curious" for empty search results.
   */
  mascotMood?: MascotMood;
  /** Set true to hide the mascot entirely (e.g. for very small inline spots). */
  hideMascot?: boolean;
}

/**
 * EmptyState — friendly placeholder for empty lists / no-results / first-run.
 *
 * Used by: ContinueWatching, History, MyLibrary sections, Search results.
 * Per the redesign plan §6: avoid "busy" mascot placement; one tasteful icon,
 * short title, optional description, optional actions.
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  compact = false,
  mascotMood = "happy",
  hideMascot = false,
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-10" : "py-20"
      } px-6`}
    >
      {icon ? (
        <div
          className={`mb-4 flex items-center justify-center rounded-full bg-xan-card border border-xan-border ${
            compact ? "w-12 h-12" : "w-16 h-16"
          }`}
        >
          {icon}
        </div>
      ) : hideMascot ? (
        <div
          className={`mb-4 flex items-center justify-center rounded-full bg-xan-card border border-xan-border ${
            compact ? "w-12 h-12" : "w-16 h-16"
          }`}
        >
          <Search className={compact ? "h-5 w-5" : "h-7 w-7 text-muted-foreground"} />
        </div>
      ) : (
        <XaniMascot mood={mascotMood} size={compact ? 56 : 88} className="mb-3" />
      )}
      <h3
        className={`font-display font-semibold text-foreground ${
          compact ? "text-base" : "text-lg"
        }`}
      >
        {title}
      </h3>
      {description && (
        <p
          className={`mt-1.5 text-muted-foreground max-w-sm ${
            compact ? "text-xs" : "text-sm"
          }`}
        >
          {description}
        </p>
      )}
      {(actionLabel || secondaryLabel) && (
        <div className="mt-5 flex items-center gap-2">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-xan-crimson to-xan-violet text-white px-5 h-10 text-sm font-semibold hover:shadow-[0_8px_30px_rgba(233,69,96,0.35)] transition-all"
            >
              <Sparkles className="h-4 w-4" />
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex items-center rounded-full glass-strong text-foreground border border-xan-border hover:bg-white/10 px-5 h-10 text-sm font-semibold transition-all"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
