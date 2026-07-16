// ─── RelatedAnime — Premium Glass Redesign ──────────────────────
// Two sub-sections:
//  1. Relations — glass cards with cover thumbnail (12×16), role/type
//     label, hover lift with crimson glow, arrow icon on hover, cover
//     image zoom (scale-110) on hover, title transitions to crimson.
//  2. Recommendations — poster-style cards with aspect-[2/3], hover
//     glow overlay (crimson gradient from bottom), image zoom on hover
//     (scale-110, 500ms), score badge in top-right, title transitions
//     to crimson.
//
// Each section header has the accent line (crimson→violet gradient bar)
// beside the title plus an item count on the right.

import { Link } from "react-router-dom";
import { ArrowUpRight, Star } from "lucide-react";
import { getTitle, type AnimeCard, type AnimeDetail } from "../../lib/anilist";

interface RelatedAnimeProps {
  anime: AnimeDetail;
}

/** Format AniList media type for display: ANIME → "Anime", MANGA → "Manga", etc. */
function formatMediaType(type: string | null | undefined): string {
  if (!type) return "Anime";
  switch (type) {
    case "ANIME": return "Anime";
    case "MANGA": return "Manga";
    case "NOVEL": return "Novel";
    case "ONE_SHOT": return "One Shot";
    case "SPECIAL": return "Special";
    case "MUSIC": return "Music";
    default: return type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ");
  }
}

export function RelatedAnime({ anime }: RelatedAnimeProps) {
  const relations = (anime.relations?.nodes ?? []).slice(0, 6);
  const recs = (anime.recommendations?.nodes ?? [])
    .map((n) => n.mediaRecommendation)
    .filter((r): r is AnimeCard => !!r)
    .slice(0, 6);

  if (relations.length === 0 && recs.length === 0) return null;

  return (
    <div className="space-y-10">
      {/* ─── Relations ─── */}
      {relations.length > 0 && (
        <section className="animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
              <h2 className="text-xl font-bold font-display text-foreground">Related</h2>
              <span className="text-xs text-muted-foreground ml-1 tabular-nums">· {relations.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {relations.map((r) => {
              const isAnime = !r.type || r.type === "ANIME";
              const typeLabel = formatMediaType(r.type);
              return (
                <Link
                  key={`r-${r.id}`}
                  to={isAnime ? `/anime/${r.id}` : `https://anilist.co/${r.type?.toLowerCase() ?? "manga"}/${r.id}`}
                  {...(!isAnime ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 hover:border-xan-crimson/40 p-2.5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_-12px_rgba(233,69,96,0.45)]"
                >
                  <div className="flex items-center gap-3">
                    {/* Cover thumbnail — 12×16 (w-12 h-16) rounded with ring */}
                    <div className="relative flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-xan-crimson/40 transition-all">
                      <img
                        src={r.coverImage?.large ?? "/placeholder.svg"}
                        alt={getTitle(r.title)}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                      />
                    </div>
                    {/* Title + type */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-tight group-hover:text-xan-crimson transition-colors">
                        {getTitle(r.title)}
                      </p>
                      <p className="mt-1 text-[10px] font-medium text-xan-crimson uppercase tracking-[0.15em]">
                        {typeLabel}
                        {r.seasonYear ? ` · ${r.seasonYear}` : ""}
                      </p>
                    </div>
                    {/* Arrow icon — visible on hover */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 group-hover:bg-xan-crimson/20 group-hover:border-xan-crimson/40">
                      <ArrowUpRight className="h-3.5 w-3.5 text-xan-crimson" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── Recommendations ─── */}
      {recs.length > 0 && (
        <section className="animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
              <h2 className="text-xl font-bold font-display text-foreground">Recommended</h2>
              <span className="text-xs text-muted-foreground ml-1 tabular-nums">· {recs.length}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recs.map((r) => (
              <Link
                key={`rec-${r.id}`}
                to={`/anime/${r.id}`}
                className="group hover-lift"
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all shadow-lg">
                  <img
                    src={r.coverImage?.large ?? "/placeholder.svg"}
                    alt={getTitle(r.title)}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                  />
                  {/* Hover glow overlay (crimson gradient from bottom) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-xan-crimson/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  {/* Title gradient (always-on, deepens on hover) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  {/* Score badge top-right */}
                  {r.averageScore != null && (
                    <div className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/80 backdrop-blur-sm border border-white/15 text-[9px] font-bold text-white">
                      <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                      {Math.round(r.averageScore)}%
                    </div>
                  )}
                  <p className="absolute bottom-2 left-2 right-2 text-[10px] font-medium text-white line-clamp-2 leading-tight group-hover:text-xan-crimson transition-colors">
                    {getTitle(r.title)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
