import { useState, useEffect, useMemo } from "react";
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
  Bookmark,
  Share2,
  Search as SearchIcon,
  AlertCircle,
} from "lucide-react";
import {
  fetchAnimeDetail,
  getTitle,
  type AnimeDetail,
} from "../lib/anilist";
import { useBookmarks } from "../hooks/useBookmarks";
import { useCountdownTick, formatCountdown } from "../hooks/useCountdownTick";
import { AnimeStatusButton } from "../components/AnimeStatusButton";

const EPISODES_PER_PAGE = 100;

export function AnimeDetail() {
  const { id } = useParams<{ id: string }>();
  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Episode panel state
  const [epPage, setEpPage] = useState(1);
  const [epSearch, setEpSearch] = useState("");
  const [jumpTo, setJumpTo] = useState("");

  const { isBookmarked, toggleBookmark } = useBookmarks();

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setEpPage(1);
      setEpSearch("");
      const d = await fetchAnimeDetail(parseInt(id, 10));
      setAnime(d);
      setLoading(false);
    })();
  }, [id]);

  // NOTE: useMemo MUST come before any early return — React's rules of hooks
  // require hooks to be called unconditionally and in the same order every render.
  // When episodes is null (common for long-running shows like One Piece with 1168+ eps),
  // derive from nextAiringEpisode (episode - 1 = latest aired) or use 0
  const totalEpisodes = anime?.episodes ?? (anime?.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 0);
  const nextAirEp = anime?.nextAiringEpisode?.episode ?? null; // first unaired episode number
  const filteredEpisodes = useMemo(() => {
    if (!epSearch.trim()) return Array.from({ length: totalEpisodes }, (_, i) => i + 1);
    const n = parseInt(epSearch, 10);
    if (!isNaN(n) && n >= 1 && n <= totalEpisodes) return [n];
    return [];
  }, [epSearch, totalEpisodes]);

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
        <AlertCircle className="h-10 w-10 text-xan-crimson mx-auto mb-3" />
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
  const bookmarked = isBookmarked(anime.id);

  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / EPISODES_PER_PAGE));
  const safePage = Math.min(epPage, totalPages);
  const pagedEpisodes = filteredEpisodes.slice(
    (safePage - 1) * EPISODES_PER_PAGE,
    safePage * EPISODES_PER_PAGE,
  );

  const handleJump = () => {
    const n = parseInt(jumpTo, 10);
    if (isNaN(n) || n < 1 || n > totalEpisodes) return;
    const targetPage = Math.ceil(n / EPISODES_PER_PAGE);
    setEpPage(targetPage);
    setEpSearch("");
    // Scroll to episode grid
    setTimeout(() => {
      const el = document.getElementById(`ep-${n}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  return (
    <div className="pb-16">
      {/* ─── Cinematic Hero ─── */}
      <section className="relative">
        {/* Banner background */}
        <div className="relative h-[40vh] min-h-[320px] max-h-[480px] w-full overflow-hidden">
          {anime.bannerImage ? (
            <img
              src={anime.bannerImage}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => {
                // If banner fails to load, swap to the color-wash fallback
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          {/* When no banner, use a color-wash gradient from the cover color */}
          {!anime.bannerImage && (
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(135deg, ${anime.coverImage?.color ?? "#e94560"}33 0%, var(--color-xan-dark) 50%, ${anime.coverImage?.color ?? "#e94560"}22 100%)`,
              }}
            />
          )}
          {/* Blurred cover image as subtle texture (only when no banner) */}
          {!anime.bannerImage && (
            <img
              src={anime.coverImage.extraLarge || anime.coverImage.large}
              alt=""
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover opacity-20 scale-110 blur-3xl"
            />
          )}
          {/* Gradient overlays for legibility — always applied */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-transparent to-transparent" />
        </div>

        {/* Content overlay */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-32 md:-mt-40 lg:-mt-48 relative z-10">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 glass px-3 py-1.5 rounded-full"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>

          <div className="flex flex-col md:flex-row gap-6 md:gap-8">
            {/* Cover image with glow */}
            <div className="flex-shrink-0 mx-auto md:mx-0 relative">
              <div
                className="absolute -inset-2 rounded-2xl blur-lg opacity-50"
                style={{ background: `linear-gradient(135deg, ${anime.coverImage?.color ?? "#e94560"}, ${anime.coverImage?.color ?? "#7b2ff7"}55)` }}
              />
              <img
                src={anime.coverImage.large}
                alt={title}
                className="relative w-36 h-52 sm:w-40 sm:h-60 md:w-44 md:h-64 lg:w-48 lg:h-72 rounded-xl object-cover border-2 border-xan-border shadow-2xl"
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
              />
            </div>

            {/* Title + meta */}
            <div className="flex-1 space-y-3 md:pt-12 lg:pt-20 text-center md:text-left">
              {/* Genres as pills (top) */}
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center md:justify-start">
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

              <h1 className="text-2xl md:text-4xl lg:text-5xl font-bold font-display text-foreground leading-tight">
                {title}
              </h1>

              {/* Romaji subtitle if different from english */}
              {anime.title.english && anime.title.romaji && anime.title.english !== anime.title.romaji && (
                <p className="text-sm text-muted-foreground italic">
                  {anime.title.romaji}
                </p>
              )}

              {/* Stats row */}
              <div className="flex flex-wrap items-center gap-3 text-sm justify-center md:justify-start">
                {anime.averageScore && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass">
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
                    <span className="font-bold text-foreground">{Math.round(anime.averageScore)}%</span>
                  </span>
                )}
                {anime.episodes != null && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Tv className="h-3.5 w-3.5" /> {anime.episodes} eps
                  </span>
                )}
                {anime.seasonYear && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {anime.season
                      ? `${anime.season.charAt(0)}${anime.season.slice(1).toLowerCase()} ${anime.seasonYear}`
                      : anime.seasonYear}
                  </span>
                )}
                {anime.format && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium glass text-muted-foreground">
                    {anime.format}
                  </span>
                )}
                {anime.status && (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        anime.status === "RELEASING" ? "bg-green-500 animate-pulse" : "bg-zinc-500"
                      }`}
                    />
                    {anime.status === "RELEASING"
                      ? "Ongoing"
                      : anime.status === "FINISHED"
                        ? "Completed"
                        : anime.status === "NOT_YET_RELEASED"
                          ? "Upcoming"
                          : anime.status}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2 flex-wrap justify-center md:justify-start">
                <Link
                  to={`/watch/${anime.id}?ep=1`}
                  className="btn-premium inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-violet hover:opacity-90 font-semibold text-white transition-all shadow-lg shadow-xan-crimson/30"
                >
                  <Play className="h-4 w-4 fill-white" /> Watch Now
                </Link>
                <AnimeStatusButton
                  animeId={anime.id}
                  title={title}
                  coverImage={anime.coverImage.large}
                />
                <button
                  onClick={() =>
                    toggleBookmark({
                      animeId: anime.id,
                      title,
                      coverImage: anime.coverImage.large,
                    })
                  }
                  className={`p-3 rounded-xl glass transition-all hover-lift ${
                    bookmarked ? "text-xan-crimson" : "text-muted-foreground hover:text-xan-crimson"
                  }`}
                  title={bookmarked ? "Remove bookmark" : "Add bookmark"}
                  aria-label={bookmarked ? "Remove bookmark" : "Add bookmark"}
                >
                  <Bookmark className={`h-4 w-4 ${bookmarked ? "fill-current" : ""}`} />
                </button>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title, url: window.location.href }).catch(() => {});
                    } else {
                      navigator.clipboard?.writeText(window.location.href);
                    }
                  }}
                  className="p-3 rounded-xl glass text-muted-foreground hover:text-xan-crimson transition-all hover-lift"
                  title="Share"
                  aria-label="Share"
                >
                  <Share2 className="h-4 w-4" />
                </button>
              </div>

              {/* Next airing countdown */}
              {anime.nextAiringEpisode && <NextAiringCard anime={anime} />}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Content sections (2/3 + 1/3 split) ─── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main column (2/3) */}
          <div className="lg:col-span-2 space-y-10">
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
                      __html: anime.description
                        .replace(/<br\s*\/?>/g, " ")
                        .replace(/<[^>]+>/g, ""),
                    }}
                  />
                </div>
              </section>
            )}

            {/* Episodes (windowed) */}
            <section className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
                  <h2 className="text-lg font-semibold font-display text-foreground">Episodes</h2>
                </div>
                {totalEpisodes > EPISODES_PER_PAGE && (
                  <span className="text-xs text-muted-foreground">
                    Page {safePage} of {totalPages} • Showing{" "}
                    {(safePage - 1) * EPISODES_PER_PAGE + 1}-
                    {Math.min(safePage * EPISODES_PER_PAGE, totalEpisodes)} of {totalEpisodes}
                  </span>
                )}
              </div>

              {totalEpisodes > 0 ? (
                <>
                  {/* Search + Jump-to */}
                  {totalEpisodes > EPISODES_PER_PAGE && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      <div className="relative flex-1 min-w-[180px]">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                          type="text"
                          value={epSearch}
                          onChange={(e) => {
                            setEpSearch(e.target.value);
                            setEpPage(1);
                          }}
                          placeholder="Search episode number..."
                          className="w-full pl-9 pr-3 h-9 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={jumpTo}
                          onChange={(e) => setJumpTo(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleJump()}
                          placeholder="Jump to ep"
                          min={1}
                          max={totalEpisodes}
                          className="w-28 h-9 px-3 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50"
                        />
                        <button
                          onClick={handleJump}
                          className="h-9 px-3 rounded-lg bg-xan-card border border-xan-border hover:bg-xan-card-hover text-sm font-medium transition-colors"
                        >
                          Go
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                    {pagedEpisodes.map((ep) => {
                      const isUnaired = nextAirEp !== null && ep >= nextAirEp;
                      const isNextAiring = nextAirEp !== null && ep === nextAirEp;
                      if (isUnaired) {
                        // Unaired episode — disabled, no link, shows SOON
                        return (
                          <div
                            key={ep}
                            id={`ep-${ep}`}
                            className={`aspect-square flex flex-col items-center justify-center rounded-xl border text-sm font-medium relative overflow-hidden cursor-not-allowed ${
                              isNextAiring
                                ? "border-xan-crimson/30 bg-xan-crimson/5 text-xan-crimson/40"
                                : "border-xan-border/30 bg-xan-card/20 text-muted-foreground/20"
                            }`}
                            title={isNextAiring ? "Next episode — airing soon" : "Not yet aired"}
                          >
                            <span className="relative">{ep}</span>
                            {isNextAiring && (
                              <span className="absolute top-0.5 right-0.5 text-[7px] font-bold text-xan-crimson/60 uppercase tracking-wide">
                                Soon
                              </span>
                            )}
                          </div>
                        );
                      }
                      return (
                        <Link
                          key={ep}
                          id={`ep-${ep}`}
                          to={`/watch/${anime.id}?ep=${ep}`}
                          className="group aspect-square flex flex-col items-center justify-center rounded-xl glass border text-sm font-medium transition-all hover-lift relative overflow-hidden border-xan-border hover:border-xan-crimson/50"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-xan-crimson/10 to-xan-violet/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="relative">{ep}</span>
                        </Link>
                      );
                    })}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4">
                      <button
                        onClick={() => setEpPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border border-xan-border bg-xan-card hover:bg-xan-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Prev
                      </button>
                      <span className="text-sm text-muted-foreground px-2">
                        {safePage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setEpPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        className="px-3 py-1.5 rounded-lg text-sm font-medium border border-xan-border bg-xan-card hover:bg-xan-card-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="glass rounded-2xl p-8 text-center space-y-4">
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Episode count unknown for this title. Start watching from episode 1 — the player
                    will let you navigate to the next episode.
                  </p>
                  <Link
                    to={`/watch/${anime.id}?ep=1`}
                    className="btn-premium inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-violet font-semibold text-white transition-all shadow-lg shadow-xan-crimson/30"
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
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                  {anime.characters.nodes.map((c) => (
                    <div
                      key={c.id}
                      className="w-24 sm:w-28 shrink-0 group card-enter"
                      style={{ "--card-index": 0 } as React.CSSProperties}
                    >
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all">
                        <img
                          src={c.image.large}
                          alt={c.name.full}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-medium text-white line-clamp-2 leading-tight">
                          {c.name.full}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar (1/3) */}
          <aside className="space-y-6">
            {/* Information grid */}
            <section className="animate-fade-in-up">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
                <h2 className="text-lg font-semibold font-display text-foreground">Information</h2>
              </div>
              <div className="space-y-2">
                {studioNames.length > 0 && (
                  <InfoRow icon={Building2} label="Studio" value={studioNames.join(", ")} />
                )}
                {anime.seasonYear && (
                  <InfoRow
                    icon={Calendar}
                    label="Season"
                    value={
                      anime.season
                        ? `${anime.season.charAt(0)}${anime.season.slice(1).toLowerCase()} ${anime.seasonYear}`
                        : String(anime.seasonYear)
                    }
                  />
                )}
                {anime.format && <InfoRow icon={Film} label="Format" value={anime.format} />}
                {anime.episodes != null && (
                  <InfoRow icon={Tv} label="Episodes" value={String(anime.episodes)} />
                )}
                {anime.duration && (
                  <InfoRow icon={Clock} label="Duration" value={`${anime.duration} min/ep`} />
                )}
                {anime.status && (
                  <InfoRow
                    icon={Tv}
                    label="Status"
                    value={
                      anime.status === "RELEASING"
                        ? "Ongoing"
                        : anime.status === "FINISHED"
                          ? "Completed"
                          : anime.status === "NOT_YET_RELEASED"
                            ? "Upcoming"
                            : anime.status
                    }
                  />
                )}
                {anime.averageScore && (
                  <InfoRow
                    icon={Star}
                    label="Score"
                    value={`${Math.round(anime.averageScore)}%`}
                  />
                )}
              </div>
            </section>

            {/* Relations + Recommendations (combined) */}
            {(anime.relations?.nodes?.length > 0 ||
              anime.recommendations?.nodes?.length > 0) && (
              <section className="animate-fade-in-up">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
                  <h2 className="text-lg font-semibold font-display text-foreground">Related & Recommended</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {anime.relations.nodes.slice(0, 4).map((r) => (
                    <Link key={`r-${r.id}`} to={`/anime/${r.id}`} className="group hover-lift">
                      <div className="aspect-[2/3] rounded-lg overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all relative">
                        <img
                          src={r.coverImage.large}
                          alt={getTitle(r.title)}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-medium text-white line-clamp-2 leading-tight">
                          {getTitle(r.title)}
                        </p>
                      </div>
                    </Link>
                  ))}
                  {anime.recommendations.nodes.slice(0, 4).map((r) => (
                    <Link key={`rec-${r.mediaRecommendation.id}`} to={`/anime/${r.mediaRecommendation.id}`} className="group hover-lift">
                      <div className="aspect-[2/3] rounded-lg overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all relative">
                        <img
                          src={r.mediaRecommendation.coverImage.large}
                          alt={getTitle(r.mediaRecommendation.title)}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                        <p className="absolute bottom-1.5 left-1.5 right-1.5 text-[10px] font-medium text-white line-clamp-2 leading-tight">
                          {getTitle(r.mediaRecommendation.title)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function NextAiringCard({ anime }: { anime: AnimeDetail }) {
  const now = useCountdownTick();
  if (!anime.nextAiringEpisode) return null;
  const airingAt = anime.nextAiringEpisode.airingAt * 1000;
  const remaining = Math.max(0, Math.floor((airingAt - now) / 1000));
  return (
    <div className="glass rounded-xl p-3 flex items-center gap-3 max-w-md animate-fade-in-up">
      <div className="w-10 h-10 rounded-lg bg-xan-crimson/20 flex items-center justify-center flex-shrink-0">
        <Clock className="h-5 w-5 text-xan-crimson" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Next Episode</p>
        <p className="text-sm font-semibold text-foreground">
          Episode {anime.nextAiringEpisode.episode} •{" "}
          <span className="text-xan-crimson font-mono">
            {formatCountdown(remaining)}
          </span>
        </p>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg hover:bg-xan-card/50 transition-colors">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-xan-crimson" />
        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
          {label}
        </span>
      </div>
      <span className="text-sm font-semibold text-foreground text-right line-clamp-1">{value}</span>
    </div>
  );
}
