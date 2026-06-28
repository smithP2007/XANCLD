import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Star,
  Calendar,
  Tv,
  Clock,
  Building2,
  Film,
  Heart,
  Share2,
} from "lucide-react";
import {
  fetchAnimeDetail,
  getTitle,
  type AnimeDetail,
} from "../lib/anilist";

export function AnimeDetail() {
  const { id } = useParams<{ id: string }>();
  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      const d = await fetchAnimeDetail(parseInt(id, 10));
      setAnime(d);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <div className="animate-spin h-10 w-10 border-2 border-xan-crimson border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!anime) {
    return (
      <div className="text-center py-40">
        <p className="text-muted-foreground">Anime not found.</p>
        <Link to="/home" className="text-xan-crimson mt-2 inline-block">
          Go home
        </Link>
      </div>
    );
  }

  const title = getTitle(anime.title);
  const animationStudios = anime.studios?.nodes?.filter((s) => s.isAnimationStudio) ?? [];
  const studioNames = animationStudios.length > 0
    ? animationStudios.map((s) => s.name)
    : (anime.studios?.nodes ?? []).map((s) => s.name);
  const genres = anime.genres ?? [];

  return (
    <div className="pb-16">
      {/* ─── Cinematic Hero ─── */}
      <section className="relative">
        {/* Banner with parallax-like depth */}
        <div className="relative h-[45vh] min-h-[360px] max-h-[520px]">
          {anime.bannerImage ? (
            <img
              src={anime.bannerImage}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <img
              src={anime.coverImage.extraLarge || anime.coverImage.large}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-50"
            />
          )}
          {/* Multi-layer gradient for cinematic depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-background/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-transparent" />
        </div>

        {/* Content overlay */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-40 md:-mt-48 relative z-10">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 glass px-3 py-1.5 rounded-full"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>

          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Cover image with glow */}
            <div className="flex-shrink-0 mx-auto md:mx-0 relative">
              <div className="absolute -inset-1 bg-gradient-to-br from-xan-crimson/30 to-xan-violet/30 rounded-2xl blur-lg opacity-60" />
              <img
                src={anime.coverImage.large}
                alt={title}
                className="relative w-40 h-60 md:w-48 md:h-72 rounded-xl object-cover border-2 border-xan-border shadow-2xl"
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
              />
            </div>

            {/* Title + meta */}
            <div className="flex-1 space-y-4 md:pt-20">
              {/* Genres as pills (top) */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {genres.slice(0, 4).map((g) => (
                    <span
                      key={g}
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-medium glass text-muted-foreground uppercase tracking-wide"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <h1 className="text-3xl md:text-5xl font-bold font-display text-foreground leading-tight">
                {title}
              </h1>

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {anime.averageScore && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass">
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
                    <span className="font-bold text-foreground">{Math.round(anime.averageScore)}%</span>
                  </span>
                )}
                {anime.episodes && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Tv className="h-3.5 w-3.5" /> {anime.episodes} eps
                  </span>
                )}
                {anime.seasonYear && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> {anime.seasonYear}
                  </span>
                )}
                {anime.format && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium glass text-muted-foreground">
                    {anime.format}
                  </span>
                )}
                {anime.status && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span className={`w-1.5 h-1.5 rounded-full ${anime.status === "RELEASING" ? "bg-green-500 animate-pulse" : "bg-zinc-500"}`} />
                    {anime.status === "RELEASING" ? "Ongoing" : anime.status === "FINISHED" ? "Completed" : anime.status}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 pt-2">
                <Link
                  to={`/watch/${anime.id}`}
                  className="btn-premium inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-crimson-dark hover:from-xan-crimson-dark hover:to-xan-crimson font-semibold text-white transition-all shadow-lg shadow-xan-crimson/30"
                >
                  <Play className="h-4 w-4 fill-white" /> Watch Now
                </Link>
                <button className="p-3 rounded-xl glass text-muted-foreground hover:text-xan-crimson transition-all hover-lift" title="Add to favorites">
                  <Heart className="h-4 w-4" />
                </button>
                <button className="p-3 rounded-xl glass text-muted-foreground hover:text-xan-crimson transition-all hover-lift" title="Share">
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Content sections ─── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-10 space-y-10">
        {/* Synopsis */}
        {anime.description && (
          <section className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
              <h2 className="text-lg font-semibold font-display text-foreground">Synopsis</h2>
            </div>
            <div className="glass rounded-2xl p-5 md:p-6">
              <p
                className="text-sm md:text-base text-muted-foreground leading-relaxed max-w-3xl"
                dangerouslySetInnerHTML={{
                  __html: anime.description.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, ""),
                }}
              />
            </div>
          </section>
        )}

        {/* Information grid */}
        <section className="animate-fade-in-up">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
            <h2 className="text-lg font-semibold font-display text-foreground">Information</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {studioNames.length > 0 && (
              <InfoCard icon={Building2} label="Studio" value={studioNames.join(", ")} />
            )}
            {anime.seasonYear && <InfoCard icon={Calendar} label="Year" value={String(anime.seasonYear)} />}
            {anime.format && <InfoCard icon={Film} label="Format" value={anime.format} />}
            {anime.episodes && <InfoCard icon={Tv} label="Episodes" value={String(anime.episodes)} />}
            {anime.duration && <InfoCard icon={Clock} label="Duration" value={`${anime.duration} min`} />}
          </div>
        </section>

        {/* Episodes */}
        <section className="animate-fade-in-up">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
              <h2 className="text-lg font-semibold font-display text-foreground">Episodes</h2>
            </div>
            {anime.episodes && anime.episodes > 50 && (
              <span className="text-xs text-muted-foreground">Showing first 50 of {anime.episodes}</span>
            )}
          </div>
          {anime.episodes && anime.episodes > 0 ? (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {Array.from({ length: Math.min(anime.episodes, 50) }, (_, i) => i + 1).map((ep) => (
                <Link
                  key={ep}
                  to={`/watch/${anime.id}?ep=${ep}`}
                  className="group aspect-square flex flex-col items-center justify-center rounded-xl glass border border-xan-border hover:border-xan-crimson/50 text-sm font-medium transition-all hover-lift relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-xan-crimson/10 to-xan-violet/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative">{ep}</span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="glass rounded-2xl p-8 text-center space-y-4">
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Episode count unknown for this title. Start watching from episode 1 —
                the player will let you navigate to the next episode.
              </p>
              <Link
                to={`/watch/${anime.id}?ep=1`}
                className="btn-premium inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-crimson-dark font-semibold text-white transition-all shadow-lg shadow-xan-crimson/30"
              >
                <Play className="h-4 w-4 fill-white" /> Watch Episode 1
              </Link>
            </div>
          )}
        </section>

        {/* Characters */}
        {anime.characters?.nodes?.length > 0 && (
          <section className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
              <h2 className="text-lg font-semibold font-display text-foreground">Characters</h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-3 scroll-smooth">
              {anime.characters.nodes.map((c) => (
                <div key={c.id} className="w-28 shrink-0 group">
                  <div className="relative w-28 h-40 rounded-xl overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all">
                    <img
                      src={c.image.large}
                      alt={c.name.full}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="mt-2 text-xs line-clamp-2 font-medium text-foreground group-hover:text-xan-crimson transition-colors">
                    {c.name.full}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Relations */}
        {anime.relations?.nodes?.length > 0 && (
          <section className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
              <h2 className="text-lg font-semibold font-display text-foreground">Relations</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {anime.relations.nodes.slice(0, 6).map((r) => (
                <Link key={r.id} to={`/anime/${r.id}`} className="group hover-lift">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all relative">
                    <img
                      src={r.coverImage.large}
                      alt={getTitle(r.title)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <p className="mt-1.5 text-xs line-clamp-2 group-hover:text-xan-crimson transition-colors text-foreground">
                    {getTitle(r.title)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Recommendations */}
        {anime.recommendations?.nodes?.length > 0 && (
          <section className="animate-fade-in-up">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
              <h2 className="text-lg font-semibold font-display text-foreground">Recommendations</h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
              {anime.recommendations.nodes.slice(0, 6).map((r) => (
                <Link key={r.mediaRecommendation.id} to={`/anime/${r.mediaRecommendation.id}`} className="group hover-lift">
                  <div className="aspect-[2/3] rounded-xl overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all relative">
                    <img
                      src={r.mediaRecommendation.coverImage.large}
                      alt={getTitle(r.mediaRecommendation.title)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <p className="mt-1.5 text-xs line-clamp-2 group-hover:text-xan-crimson transition-colors text-foreground">
                    {getTitle(r.mediaRecommendation.title)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="glass rounded-xl p-4 hover-lift group">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="h-3.5 w-3.5 text-xan-crimson" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground line-clamp-2">{value}</p>
    </div>
  );
}
