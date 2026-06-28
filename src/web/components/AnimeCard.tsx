import { Link } from "react-router-dom";
import type { AnimeCard } from "../lib/anilist";
import { getTitle } from "../lib/anilist";

export function AnimeCard({ anime }: { anime: AnimeCard }) {
  const title = getTitle(anime.title);
  return (
    <Link to={`/anime/${anime.id}`} className="group block hover-lift">
      <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-xan-card border border-xan-border transition-all duration-400 group-hover:border-xan-crimson/50 group-hover:shadow-[0_12px_40px_rgba(233,69,96,0.2)]">
        <img
          src={anime.coverImage.large}
          alt={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/placeholder.svg";
          }}
        />
        {/* Score badge */}
        {anime.averageScore && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/80 backdrop-blur text-xs font-bold text-white">
            {Math.round(anime.averageScore)}%
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
        <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-all duration-400 translate-y-2 group-hover:translate-y-0">
          <div className="text-xs text-white/90 space-y-0.5">
            <p className="font-medium">{anime.format ?? "TV"}</p>
            <p>{anime.episodes ? `${anime.episodes} eps` : anime.status ?? "Ongoing"}</p>
            {anime.seasonYear && <p>{anime.seasonYear}</p>}
          </div>
        </div>
      </div>
      <h3 className="mt-2 font-medium text-sm text-foreground line-clamp-2 leading-snug group-hover:text-xan-crimson transition-colors duration-300">
        {title}
      </h3>
    </Link>
  );
}
