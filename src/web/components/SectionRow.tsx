import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  badge?: string;
}

export function SectionRow({ title, subtitle, icon, children, badge }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.8, 900);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="group/section space-y-3">
      {/* Header row with gradient accent */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Gradient accent line */}
          <div className="w-1 h-7 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-xan-crimson/15 to-xan-violet/15 border border-xan-border flex items-center justify-center">
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-base md:text-xl font-bold font-display text-foreground flex items-center gap-2">
              {title}
              {badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/30">
                  {badge}
                </span>
              )}
            </h2>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {/* Scroll arrows — appear on hover on desktop, always visible on mobile */}
        <div className="flex items-center gap-1.5 opacity-60 group-hover/section:opacity-100 transition-opacity">
          <button
            onClick={() => scrollBy("left")}
            aria-label="Scroll left"
            className="rounded-full glass border border-xan-border hover:bg-xan-crimson/20 hover:border-xan-crimson/40 h-8 w-8 md:h-9 md:w-9 flex items-center justify-center transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollBy("right")}
            aria-label="Scroll right"
            className="rounded-full glass border border-xan-border hover:bg-xan-crimson/20 hover:border-xan-crimson/40 h-8 w-8 md:h-9 md:w-9 flex items-center justify-center transition-all"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Horizontal scroller with scroll-snap */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-2 mask-fade-r snap-x snap-mandatory scroll-pl-4"
      >
        {children}
      </div>
    </section>
  );
}
