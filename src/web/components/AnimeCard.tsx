import { memo } from "react";
import { Link } from "react-router-dom";
import { Star, Play, Clock, Bookmark } from "lucide-react";
import type { AnimeCard as AnimeCardT } from "../lib/anilist";
import { getTitle } from "../lib/anilist";
import { useIsBookmarked, useToggleBookmark } from "../hooks/useBookmarks";

interface Props {
  anime: AnimeCardT;
  index?: number;
  priority?: boolean;
}

// B7 FIX: memo'd + per-id bookmark selector. Previously every card instance
// subscribed to the WHOLE bookmarks list, so toggling one bookmark
// re-rendered every card in every visible grid. Now a card re-renders only
// when its own bookmark flips or its `anime`/`index` props change.
//
// v4 ROSA: NEW FORM — a framed card. The poster sits on top with rounded
// corners and the title/meta moved BELOW the image onto the card surface
// (was overlaid on the artwork). Score moved from the image overlay into
// the info row. Hover lifts the whole card with a rose border.
function AnimeCardBase({ anime, index = 0 }: Props) {
  const title = getTitle(anime.title);
  const image = anime.coverImage?.large ?? anime.coverImage?.extraLarge ?? "/placeholder.svg";
  const score = anime.averageScore ? `${Math.round(anime.averageScore)}%` : null;
  const episodes = anime.episodes ? `${anime.episodes} eps` : anime.status ?? "Ongoing";
  const bookmarked = useIsBookmarked(anime.id);
  const toggleBookmark = useToggleBookmark();

  return (
    <div
      className="group relative card-enter"
      style={{ "--card-index": index } as React.CSSProperties}
    >
      <Link to={`/anime/${anime.id}`} className="block">
        <div className="overflow-hidden rounded-[18px] border border-xan-border bg-xan-card transition-all duration-300 group-hover:-translate-y-1.5 group-hover:border-xan-crimson/50 group-hover:shadow-[0_20px_44px_rgba(0,0,0,0.45)]">
          {/* Poster */}
          <div className="relative aspect-[2/3] overflow-hidden bg-xan-surface">
            <img
              src={image}
              alt={title}
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder.svg";
              }}
            />

            {/* Soft bottom fade for chip legibility */}
            <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

            {/* Movie chip — top-left (repositioned) */}
            {anime.format === "MOVIE" && (
              <div className="absolute left-2 top-2 rounded-full bg-gradient-to-r from-xan-crimson to-xan-violet px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white">
                Movie
              </div>
            )}

            {/* Bookmark button — top-right, hover-reveal on desktop */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleBookmark({
                  animeId: anime.id,
                  title,
                  coverImage: image,
                });
              }}
              aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
              className={`absolute right-1.5 top-1.5 z-20 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition-all ${
                bookmarked
                  ? "border-transparent bg-xan-crimson text-white opacity-100"
                  : "border-white/10 bg-black/55 text-white/85 opacity-0 hover:bg-black/80 focus-within:opacity-100 group-hover:opacity-100"
              }`}
            >
              <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-white" : ""}`} />
            </button>

            {/* Hover play pill */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex h-11 w-11 scale-90 items-center justify-center rounded-full bg-gradient-to-br from-xan-crimson to-xan-violet shadow-[0_8px_24px_rgba(233,69,96,0.45)] transition-transform group-hover:scale-100">
                <Play className="ml-0.5 h-4.5 w-4.5 fill-white text-white" />
              </div>
            </div>
          </div>

          {/* Info BELOW the poster on the card surface (new position) */}
          <div className="p-2.5 md:p-3">
            <h3 className="line-clamp-1 text-[13px] font-bold leading-snug tracking-tight text-foreground transition-colors group-hover:text-xan-crimson">
              {title}
            </h3>
            {/* v4.4.3 META-SHRED FIX: on narrow cards (w-[150px] → ~130px
                content) this row used to shrink items below their text width
                and wrap MID-UNIT — "25" / "eps" / "2012" shredded across 3
                ragged lines. Now every logical unit (score / clock+episodes /
                dot+year) is `whitespace-nowrap`, so text can never split
                internally; the row itself is `flex-wrap` so it breaks cleanly
                BETWEEN units instead. Separator dots live INSIDE the unit
                they precede, so a wrapped line never ends with a dangling
                dot. gap-x matches the old gap-1.5 rhythm exactly. */}
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-semibold leading-tight text-muted-foreground">
              {score && (
                <span className="flex items-center gap-1 whitespace-nowrap font-bold text-xan-crimson">
                  <Star className="h-3 w-3 shrink-0 fill-xan-crimson" />
                  {score}
                </span>
              )}
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                {score && (
                  <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-muted-foreground/50" />
                )}
                <Clock className="h-3 w-3 shrink-0" />
                {episodes}
              </span>
              {anime.seasonYear && (
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  {anime.seasonYear}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

export const AnimeCard = memo(AnimeCardBase);
