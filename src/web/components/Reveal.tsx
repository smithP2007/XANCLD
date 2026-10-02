import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSettings } from "../hooks/useSettings";

/**
 * v4.3 LIVELY — scroll-reveal wrapper.
 *
 * Children start hidden (opacity 0, +26px) and fade/slide in the first time
 * they enter the viewport (one-shot IntersectionObserver). Gives the home
 * feed a staggered, "alive" feel as you scroll.
 *
 * Accessibility: reduced-motion users get the global 0.001ms animation rule
 * (fill completes instantly), and TV-mode — which kills animations outright —
 * plus prefers-reduced-motion are gated here in JSX so content can never be
 * trapped invisible.
 */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [settings] = useSettings();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  const forceVisible = settings.reducedMotion || settings.tvMode;

  useEffect(() => {
    if (forceVisible || shown) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      // Fire slightly before the section is fully on screen
      { rootMargin: "0px 0px -6% 0px", threshold: 0.04 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [forceVisible, shown]);

  return (
    <div
      ref={ref}
      className={`${shown ? "animate-reveal" : "reveal-pending"} ${className}`}
    >
      {children}
    </div>
  );
}
