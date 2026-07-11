import { Link } from "react-router-dom";
import { Star, Play, Clock, Bookmark } from "lucide-react";
import type { AnimeCard as AnimeCardT } from "../lib/anilist";
import { getTitle } from "../lib/anilist";
import { useBookmarks } from "../hooks/useBookmarks";

interface Props {
  anime: AnimeCardT;
  index?: number;
  priority?: boolean;
}

export function AnimeCard({ anime, index = 0 }: Props) {
  const title = getTitle(anime.title);
  const image = anime.coverImage?.large ?? anime.coverImage?.extraLarge ?? "/placeholder.svg";
  const score = anime.averageScore ? `${Math.round(anime.averageScore)}%` : null;
  const episodes = anime.episodes ? `${anime.episodes} eps` : anime.status ?? "Ongoing";
  const color = anime.coverImage?.color ?? "#e94560";
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const bookmarked = isBookmarked(anime.id);

  return (
    <div
      className="group relative card-enter"
      style={{ "--card-index": index } as React.CSSProperties}
    >
      <Link to={`/anime/${anime.id}`} className="block">
        <div className="relative aspect-[2/3] rounded-2xl overflow-hidden bg-xan-card border border-xan-border transition-all duration-500 group-hover:border-xan-crimson/50 group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.5),0_0_0_1px_rgba(233,69,96,0.1)] group-hover:-translate-y-1">
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-80 group-hover:opacity-95 transition-opacity" />

          {/* Top badges (left side — bookmark lives top-right) */}
          <div className="absolute top-2 left-2 flex items-start gap-2 pointer-events-none">
            {score && (
              <div className="flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-xs font-semibold text-white">
                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                {score}
              </div>
            )}
            {anime.format === "MOVIE" && (
              <div className="bg-black/70 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-medium text-white/80 uppercase tracking-wider">
                Movie
              </div>
            )}
          </div>

          {/* Bookmark button (top-right, hover-reveal on desktop) */}
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
            className={`absolute top-1.5 right-1.5 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              bookmarked
                ? "bg-xan-crimson text-white opacity-100"
                : "bg-black/60 text-white/80 hover:bg-black/80 opacity-0 group-hover:opacity-100 focus-within:opacity-100"
            }`}
          >
            <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-white" : ""}`} />
          </button>

          {/* Hover play button */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-xan-crimson/90 backdrop-blur-sm flex items-center justify-center shadow-lg scale-90 group-hover:scale-100 transition-transform">
              <Play className="h-5 w-5 text-white fill-white ml-0.5" />
            </div>
          </div>

          {/* Bottom content */}
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <h3 className="font-medium text-sm text-white line-clamp-2 leading-snug">{title}</h3>
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-white/60">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {episodes}
              </span>
              {anime.seasonYear && (
                <>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span>{anime.seasonYear}</span>
                </>
              )}
            </div>
          </div>

          {/* Color accent line */}
          <div
            className="absolute bottom-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: color }}
          />
        </div>
      </Link>
    </div>
  );
}
