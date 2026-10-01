import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  badge?: string;
}

// v4 ROSA: header REPOSITIONED — the small uppercase eyebrow moved from
// ABOVE the title to a subtitle line BELOW it, and the crimson vertical
// bar was replaced by a rotated gradient diamond (new form). Arrows are
// circular with rose hover accents.
export function SectionRow({ title, subtitle, icon, children, badge }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.8, 900);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="group/section space-y-4">
      {/* Header row */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-foreground md:text-2xl">
            <span className="h-2.5 w-2.5 shrink-0 rotate-45 rounded-[4px] bg-gradient-to-br from-xan-crimson to-xan-violet" />
            {title}
            {badge && (
              <span className="rounded-full border border-xan-crimson/40 bg-xan-crimson/10 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-xan-crimson">
                {badge}
              </span>
            )}
          </h2>
          {subtitle && (
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
              {icon}
              <span className="truncate">{subtitle}</span>
            </p>
          )}
        </div>
        {/* Scroll arrows — appear on hover on desktop, always visible on mobile */}
        <div className="flex flex-shrink-0 items-center gap-1.5 opacity-60 transition-opacity group-hover/section:opacity-100">
          <button
            onClick={() => scrollBy("left")}
            aria-label="Scroll left"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-xan-border bg-xan-card transition-all hover:border-xan-crimson/50 hover:bg-xan-card-hover md:h-9 md:w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollBy("right")}
            aria-label="Scroll right"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-xan-border bg-xan-card transition-all hover:border-xan-crimson/50 hover:bg-xan-card-hover md:h-9 md:w-9"
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
