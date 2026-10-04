import { memo } from "react";
import { Link } from "react-router-dom";
import { Star, Play, Bookmark } from "lucide-react";
import type { AnimeCard as AnimeCardT } from "../lib/anilist";
import { getTitle } from "../lib/anilist";
import { useIsBookmarked, useToggleBookmark } from "../hooks/useBookmarks";

interface Props {
  anime: AnimeCardT;
  index?: number;
  priority?: boolean;
}

// v4.4.3 ONE-LINE META: raw AniList status enums don't fit a 150px card in a
// single line — "RELEASING" alone is ~64px at 11px font, and
// "NOT_YET_RELEASED" even renders with raw underscores. Map to compact
// human labels; unknown values get a title-cased fallback.
const STATUS_LABEL: Record<string, string> = {
  RELEASING: "Airing",
  NOT_YET_RELEASED: "Upcoming",
  FINISHED: "Completed",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
};

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
  // v4.4.4: the episode COUNT moved to a badge on the poster (top-left,
  // number only; v4.4.5 made it a translucent glass pill). The meta line
  // below the title keeps score · status · year — status text only shows
  // when AniList gives no episode count (Airing etc.).
  const status = anime.episodes
    ? null
    : anime.status
      ? (STATUS_LABEL[anime.status] ??
        anime.status.charAt(0) + anime.status.slice(1).toLowerCase().replace(/_/g, " "))
      : "Ongoing";
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

            {/* Top-left chip — v4.4.4: series show their EPISODE COUNT here,
                number ONLY (no "eps" suffix, per user request); movies keep
                the "Movie" badge. MOVIE wins, and movies rarely have a
                meaningful count (they would read "1").
                v4.4.5: restyled from solid crimson→violet gradient to a
                TRANSLUCENT glass pill (blurred dark fill + hairline light
                border) per user reference — stays legible on any poster and
                lets the artwork show through. */}
            {anime.format === "MOVIE" ? (
              <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md">
                Movie
              </div>
            ) : anime.episodes ? (
              <div className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[10px] font-extrabold leading-4 tabular-nums text-white backdrop-blur-md">
                {anime.episodes}
              </div>
            ) : null}

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
            {/* v4.4.4 META — score · status · year, one line. The episode
                count no longer lives here (moved to the poster badge above),
                so the Clock icon is gone too. Still whitespace-nowrap and
                size-tuned so the shortest possible row stays on one line
                with room to spare on every card width. */}
            <div className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-muted-foreground sm:text-[11px]">
              {score && (
                <span className="flex items-center gap-1 font-bold text-xan-crimson">
                  <Star className="h-2.5 w-2.5 shrink-0 fill-xan-crimson sm:h-3 sm:w-3" />
                  {score}
                </span>
              )}
              {status && <span>{status}</span>}
              {anime.seasonYear && <span>{anime.seasonYear}</span>}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}

export const AnimeCard = memo(AnimeCardBase);
