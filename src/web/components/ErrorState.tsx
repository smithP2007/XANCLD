import type { ReactNode } from "react";
import { AlertCircle, RefreshCw, ArrowLeft } from "lucide-react";
import { XaniMascot } from "./XaniMascot";

interface Props {
  /** Human-readable message — never raw technical error text. */
  message: string;
  /** Optional longer description / hint. */
  description?: string;
  /** Optional retry handler. If provided, a Retry button is shown. */
  onRetry?: () => void;
  /** Optional secondary "Back" action. */
  onBack?: () => void;
  /** Optional custom icon. When provided, overrides the mascot. */
  icon?: ReactNode;
  /** Compact variant for inline use. */
  compact?: boolean;
  /**
   * Show the Xani mascot (sad mood) instead of the alert-circle icon.
   * Per the redesign plan §3, the mascot appears ONLY in empty/error states.
   * Default true. Set false to use the legacy AlertCircle icon.
   */
  showMascot?: boolean;
}

/**
 * ErrorState — friendly failure state for fetch errors, playback failures,
 * import-validation failures, etc. Per the redesign plan §6: human-readable
 * messages only, never raw technical error text.
 */
export function ErrorState({
  message,
  description,
  onRetry,
  onBack,
  icon,
  compact = false,
  showMascot = true,
}: Props) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? "py-10" : "py-20"
      } px-6`}
    >
      {icon ? (
        <div
          className={`mb-4 flex items-center justify-center rounded-full bg-xan-crimson/10 border border-xan-crimson/30 ${
            compact ? "w-12 h-12" : "w-16 h-16"
          }`}
        >
          {icon}
        </div>
      ) : showMascot ? (
        <XaniMascot mood="sad" size={compact ? 56 : 88} className="mb-3" />
      ) : (
        <div
          className={`mb-4 flex items-center justify-center rounded-full bg-xan-crimson/10 border border-xan-crimson/30 ${
            compact ? "w-12 h-12" : "w-16 h-16"
          }`}
        >
          <AlertCircle className={compact ? "h-5 w-5 text-xan-crimson" : "h-7 w-7 text-xan-crimson"} />
        </div>
      )}
      <h3
        className={`font-display font-semibold text-foreground ${
          compact ? "text-base" : "text-lg"
        }`}
      >
        {message}
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
      {(onRetry || onBack) && (
        <div className="mt-5 flex items-center gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-xan-crimson to-xan-violet text-white px-5 h-10 text-sm font-semibold hover:shadow-[0_8px_30px_rgba(233,69,96,0.35)] transition-all"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-full glass-strong text-foreground border border-xan-border hover:bg-white/10 px-5 h-10 text-sm font-semibold transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
          )}
        </div>
      )}
    </div>
  );
}
