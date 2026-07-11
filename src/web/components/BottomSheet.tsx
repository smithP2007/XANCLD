import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { lockBodyScroll, unlockBodyScroll } from "../lib/bodyScrollLock";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Rendered inside the sheet body. */
  children: ReactNode;
  /** Optional footer (e.g. action buttons). Sticky at the bottom. */
  footer?: ReactNode;
  /** When true, the sheet takes more vertical space (up to 90vh). Default: 80vh. */
  tall?: boolean;
}

/**
 * BottomSheet — reusable slide-up panel for mobile interactions.
 *
 * Per the redesign plan §4: used by AnimeDetail (episode picker) and Watch
 * (episode picker). Also usable for any future mobile-only panel.
 *
 * Behavior:
 *   - Slides up from the bottom on mobile, centered modal on desktop (sm+).
 *   - Dismissible by: backdrop click, X button, Escape key, swipe-down gesture.
 *   - Focus trap: focus moves to the sheet on open, restored to trigger on close.
 *   - Body scroll locked while open.
 *   - Respects prefers-reduced-motion (the slide-up animation is killed by the
 *     global reduced-motion CSS rule).
 */
export function BottomSheet({ open, onClose, title, children, footer, tall = false }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [dragY, setDragY] = useState(0); // swipe-down offset in px
  const dragStartY = useRef<number | null>(null);

  // Focus trap + escape + body scroll lock
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    // Move focus into the sheet
    const t = setTimeout(() => sheetRef.current?.focus(), 10);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    lockBodyScroll();
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      unlockBodyScroll();
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  // Reset drag offset when opening/closing
  useEffect(() => {
    if (!open) setDragY(0);
  }, [open]);

  // ─── Swipe-down to dismiss (native non-passive touchmove listener) ───
  // React's onTouchMove is passive by default in some browsers, so
  // e.preventDefault() inside it is a no-op. We attach a native listener
  // with { passive: false } to make the swipe-down actually lock the scroll.
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const onStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      const isHandle = target.closest("[data-bottom-sheet-handle]");
      const scrollable = target.closest("[data-bottom-sheet-scroll]");
      const atTop = !scrollable || scrollable.scrollTop <= 0;
      if (!isHandle && !atTop) return;
      dragStartY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (dragStartY.current === null) return;
      const delta = e.touches[0].clientY - dragStartY.current;
      if (delta > 0) {
        // Only allow downward drag
        setDragY(delta);
        e.preventDefault();
      }
    };
    const onEnd = () => {
      if (dragStartY.current === null) return;
      // Read latest dragY via a microtask to avoid stale closure
      setDragY((current) => {
        if (current > 100) onClose();
        return 0;
      });
      dragStartY.current = null;
    };

    sheet.addEventListener("touchstart", onStart, { passive: true });
    sheet.addEventListener("touchmove", onMove, { passive: false });
    sheet.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      sheet.removeEventListener("touchstart", onStart);
      sheet.removeEventListener("touchmove", onMove);
      sheet.removeEventListener("touchend", onEnd);
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxHeight = tall ? "90vh" : "80vh";

  return (
    <div
      className="fixed inset-0 z-[105] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : "Bottom sheet"}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm cursor-default"
        tabIndex={-1}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        tabIndex={-1}
        data-bottom-sheet-handle
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragStartY.current === null ? "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          maxHeight,
        }}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl glass-strong border border-xan-border shadow-[0_25px_70px_rgba(0,0,0,0.7)] animate-panel-up flex flex-col outline-none"
      >
        {/* Drag handle (mobile only — visual affordance for swipe-down) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 rounded-full bg-white/25" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-xan-border">
            <div className="font-semibold text-foreground">{title}</div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Body — scrollable */}
        <div
          data-bottom-sheet-scroll
          className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 no-scrollbar"
        >
          {children}
        </div>

        {/* Optional footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-xan-border bg-xan-card/40">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
