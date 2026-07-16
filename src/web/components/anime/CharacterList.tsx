// ─── CharacterList — Premium Glass Redesign ─────────────────────
// Renders a horizontal scroller of glass cards, each linking to
// /character/:id. Each card shows the character avatar + name on the
// left and (optionally) the voice actor on the right separated by a
// vertical divider, with a Mic icon + language badge.
//
// Premium affordances:
//  - backdrop-blur-xl + semi-transparent white background + rounded-2xl
//  - hover lift (-translate-y-1) with a crimson-tinted shadow glow
//  - avatar ring transitions white/10 → crimson/60 on hover
//  - role labels in uppercase tracking-[0.15em] small-caps
//  - ArrowUpRight icon appears in a small crimson circle on hover
//  - section header has a crimson→violet accent bar + item count

import { Link } from "react-router-dom";
import { useRef } from "react";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Mic,
  Users,
} from "lucide-react";

/** Character row returned by fetchAnimeDetail — keep this loose so we
 *  don't have to thread a full type through. */
export interface CharacterListItem {
  id: number;
  name: { full: string | null };
  image: { large: string | null };
}

interface CharacterListProps {
  characters: CharacterListItem[];
  /** Optional accent color (CSS hex or var()) for the avatar hover ring
   *  glow. Defaults to xan-crimson. */
  accentColor?: string;
  /** Voice actors keyed by character id. AniList's `characters` query
   *  on Media doesn't return VAs by default, so this is optional and
   *  only populated when explicitly fetched. */
  voiceActors?: Record<
    number,
    { name: string | null; image: string | null; language: string | null }
  >;
}

export function CharacterList({
  characters,
  accentColor = "var(--color-xan-crimson)",
  voiceActors,
}: CharacterListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!characters || characters.length === 0) return null;

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.8, 600);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  return (
    <section className="animate-fade-in-up">
      {/* ─── Section header with accent bar + count ─── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
          <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-xan-crimson" />
            Characters
          </h2>
          <span className="text-xs text-muted-foreground ml-1 tabular-nums">
            · {characters.length}
          </span>
        </div>
        {/* Scroll arrows (desktop) */}
        <div className="hidden md:flex items-center gap-2">
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll characters left"
            className="rounded-full glass border border-xan-border hover:bg-white/10 h-8 w-8 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll characters right"
            className="rounded-full glass border border-xan-border hover:bg-white/10 h-8 w-8 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ─── Horizontal scroller of glass cards ─── */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar pb-3 -mx-2 px-2 mask-fade-edges snap-x snap-mandatory"
      >
        {characters.map((c) => {
          const va = voiceActors?.[c.id];
          return (
            <Link
              key={c.id}
              to={`/character/${c.id}`}
              className="group snap-start flex-shrink-0 w-[280px] sm:w-[300px] rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 hover:border-xan-crimson/40 p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_-12px_rgba(233,69,96,0.45)]"
            >
              <div className="flex items-stretch gap-3">
                {/* Avatar with hover-ring */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-20 rounded-xl overflow-hidden ring-2 ring-white/10 group-hover:ring-xan-crimson/60 transition-all duration-300 shadow-md">
                    <img
                      src={c.image?.large ?? "/placeholder.svg"}
                      alt={c.name?.full ?? "Character"}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                    />
                  </div>
                  {/* ArrowUpRight circle — visible on hover */}
                  <div
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 scale-75 group-hover:scale-100"
                    style={{ background: accentColor }}
                  >
                    <ArrowUpRight className="h-3.5 w-3.5 text-white" />
                  </div>
                </div>

                {/* Name + role */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight group-hover:text-xan-crimson transition-colors">
                    {c.name?.full ?? "Unknown"}
                  </p>
                  <p className="mt-1 text-[10px] font-medium text-muted-foreground uppercase tracking-[0.15em]">
                    Character
                  </p>
                </div>

                {/* Voice actor (optional) — separated by a vertical divider */}
                {va && (
                  <div className="flex items-stretch gap-2 flex-shrink-0">
                    <div className="w-px bg-white/10" aria-hidden />
                    <div className="flex flex-col items-center justify-center text-center min-w-[64px]">
                      <div className="w-9 h-9 rounded-lg overflow-hidden ring-1 ring-white/10 mb-1">
                        {va.image ? (
                          <img
                            src={va.image}
                            alt={va.name ?? "Voice actor"}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                          />
                        ) : (
                          <div className="w-full h-full bg-xan-card" />
                        )}
                      </div>
                      <p className="text-[9px] text-muted-foreground line-clamp-1 leading-tight">
                        {va.name ?? "—"}
                      </p>
                      {va.language && (
                        <span className="mt-0.5 inline-flex items-center gap-0.5 text-[8px] font-medium text-xan-crimson uppercase tracking-wider">
                          <Mic className="h-2 w-2" />
                          {va.language}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
