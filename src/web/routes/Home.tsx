import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Play, ChevronLeft, ChevronRight, Loader2, AlertCircle, Star } from "lucide-react";
import {
  fetchTrending,
  fetchPopular,
  fetchByGenre,
  getTitle,
  GENRES,
  type AnimeCard as AnimeCardType,
} from "../lib/anilist";
import { AnimeCard } from "../components/AnimeCard";

export function Home() {
  const [trending, setTrending] = useState<AnimeCardType[]>([]);
  const [popular, setPopular] = useState<AnimeCardType[]>([]);
  const [genreAnime, setGenreAnime] = useState<Record<string, AnimeCardType[]>>({});
  const [activeGenre, setActiveGenre] = useState(GENRES[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [t, p] = await Promise.all([fetchTrending(10), fetchPopular(18)]);
        setTrending(t);
        setPopular(p);
        const g = await fetchByGenre(activeGenre, 15);
        setGenreAnime((prev) => ({ ...prev, [activeGenre]: g }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (genreAnime[activeGenre]) return;
    (async () => {
      const g = await fetchByGenre(activeGenre, 15);
      setGenreAnime((prev) => ({ ...prev, [activeGenre]: g }));
    })();
  }, [activeGenre, genreAnime]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-xan-crimson" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <AlertCircle className="h-10 w-10 text-xan-crimson mb-3" />
        <p className="text-lg font-medium">Failed to load</p>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-12">
      {/* Trending Now — hero carousel */}
      {trending.length > 0 && (
        <TrendingCarousel anime={trending} />
      )}

      {/* Popular Anime — grid */}
      {popular.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-bold font-display text-foreground">
              Popular Anime
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {popular.map((a) => (
              <AnimeCard key={a.id} anime={a} />
            ))}
          </div>
        </section>
      )}

      {/* Browse by Category */}
      <section className="space-y-4">
        <h2 className="text-xl md:text-2xl font-bold font-display text-foreground">
          Browse by Category
        </h2>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setActiveGenre(g)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeGenre === g
                  ? "bg-xan-crimson text-white"
                  : "bg-xan-card text-muted-foreground hover:text-foreground hover:bg-xan-card-hover"
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        {genreAnime[activeGenre] ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {genreAnime[activeGenre].map((a) => (
              <AnimeCard key={a.id} anime={a} />
            ))}
          </div>
        ) : (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </section>
    </div>
  );
}

function TrendingCarousel({ anime }: { anime: AnimeCardType[] }) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = 320;
    scrollRef.current.scrollBy({
      left: dir === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-foreground">
            Trending Now
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">The hottest anime right now</p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => scroll("left")}
            className="p-2 rounded-lg bg-xan-card border border-xan-border hover:bg-xan-card-hover transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="p-2 rounded-lg bg-xan-card border border-xan-border hover:bg-xan-card-hover transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Hero featured (first trending) */}
      {anime[0] && <HeroFeature anime={anime[0]} />}

      {/* Horizontal scroll carousel */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 scroll-smooth"
        style={{ scrollbarWidth: "thin" }}
      >
        {anime.slice(1).map((a) => (
          <div key={a.id} className="w-40 sm:w-44 shrink-0">
            <AnimeCard anime={a} />
          </div>
        ))}
      </div>
    </section>
  );
}

function HeroFeature({ anime }: { anime: AnimeCardType }) {
  const title = getTitle(anime.title);
  return (
    <div className="relative h-[40vh] min-h-[300px] max-h-[420px] rounded-2xl overflow-hidden border border-xan-border glow-soft">
      <img
        src={anime.coverImage.extraLarge || anime.coverImage.large}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
        <div className="max-w-2xl space-y-3 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-xan-crimson/20 backdrop-blur border border-xan-crimson/30 text-xs font-medium text-xan-crimson">
            <Star className="h-3 w-3 fill-current" /> #1 Trending
          </div>
          <h1 className="text-2xl md:text-4xl font-bold font-display text-foreground line-clamp-2 drop-shadow-lg">
            {title}
          </h1>
          <div className="flex items-center gap-3 text-sm text-white/90">
            {anime.averageScore && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
                {Math.round(anime.averageScore)}%
              </span>
            )}
            {anime.format && <span>{anime.format}</span>}
            {anime.episodes && <span>{anime.episodes} eps</span>}
            {anime.seasonYear && <span>{anime.seasonYear}</span>}
          </div>
          <Link
            to={`/watch/${anime.id}`}
            className="btn-premium inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-crimson-dark hover:from-xan-crimson-dark hover:to-xan-crimson font-semibold text-white transition-all shadow-lg shadow-xan-crimson/30"
          >
            <Play className="h-4 w-4 fill-white" />
            Watch Now
          </Link>
        </div>
      </div>
    </div>
  );
}
