// ─── BackButton ─────────────────────────────────────────────────
// A reusable back-navigation pill. Uses navigate(-1) if there's
// browser history, otherwise navigates to a fallback (default /home).
//
// Rendered as a glass pill so it overlays banners and hero sections
// without contrast issues.

import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useCallback } from "react";

interface BackButtonProps {
  fallback?: string;
  className?: string;
  label?: string;
}

export function BackButton({
  fallback = "/home",
  className = "",
  label = "Back",
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = useCallback(() => {
    // window.history.length is 1 when the page was opened in a new tab
    // (no previous entry to go back to). Fall back to a known route.
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  }, [navigate, fallback]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 text-sm font-medium text-foreground/90 hover:text-foreground transition-colors glass backdrop-blur-md bg-black/40 px-3 py-1.5 rounded-full border border-white/10 hover:border-xan-crimson/40 ${className}`}
      aria-label={label}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
