import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { lockBodyScroll, unlockBodyScroll } from "../lib/bodyScrollLock";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  /** When true, styles the confirm button as a warning color. */
  destructive?: boolean;
}

/**
 * ConfirmDialog — accessible modal for destructive actions.
 *
 * Per the redesign plan §6: traps focus while open, restores focus to the
 * triggering element on close, dismissible by Escape and backdrop click.
 * Used by: Clear History, Clear Bookmarks, Clear a status list, Clear all
 * local data, Unhide/permanently remove hidden entries.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: Props) {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Focus trap + restore
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Focus the confirm button when opening
    const t = setTimeout(() => confirmBtnRef.current?.focus(), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    lockBodyScroll();
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
      previouslyFocused.current?.focus?.();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onCancel}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
        tabIndex={-1}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-2xl glass-strong border border-xan-border shadow-[0_25px_70px_rgba(0,0,0,0.7)] animate-panel-up">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="absolute top-3 right-3 w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-6">
          <div className="flex items-start gap-3">
            {destructive && (
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-xan-crimson/15 border border-xan-crimson/30 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-xan-crimson" />
              </div>
            )}
            <div className="flex-1 pt-0.5">
              <h2 id="confirm-dialog-title" className="font-display font-semibold text-lg text-foreground">
                {title}
              </h2>
              {description && (
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full px-5 h-10 text-sm font-semibold glass border border-xan-border text-foreground hover:bg-white/10 transition-all"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmBtnRef}
              type="button"
              onClick={onConfirm}
              className={`rounded-full px-5 h-10 text-sm font-semibold text-white transition-all ${
                destructive
                  ? "bg-xan-crimson hover:bg-xan-crimson-dark shadow-[0_4px_20px_rgba(233,69,96,0.35)]"
                  : "bg-gradient-to-r from-xan-crimson to-xan-violet hover:shadow-[0_8px_30px_rgba(233,69,96,0.35)]"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
