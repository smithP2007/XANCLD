import { useState, useEffect, useMemo, useRef } from "react";
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
  List,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
} from "lucide-react";
import {
  fetchAnimeDetail,
  getTitle,
  type AnimeDetail,
} from "../lib/anilist";
import { useBookmarks } from "../hooks/useBookmarks";
import { useWatchHistory } from "../hooks/useSettings";
import { useCountdownTick, formatCountdown } from "../hooks/useCountdownTick";
import { getVibeLabel } from "../lib/vibes";
import { AnimeStatusButton } from "../components/AnimeStatusButton";
import { EpisodePickerSheet } from "../components/EpisodePickerSheet";

const EPISODES_PER_PAGE = 100;

export function AnimeDetail() {
  const { id } = useParams<{ id: string }>();
  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Episode panel state
  const [epPage, setEpPage] = useState(1);
  const [epSearch, setEpSearch] = useState("");
  const [jumpTo, setJumpTo] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  const { isBookmarked, toggleBookmark } = useBookmarks();
  const history = useWatchHistory();

  // Characters scroll refs (for arrow buttons)
  const charsScrollRef = useRef<HTMLDivElement>(null);

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

  // ─── All hooks MUST come before any early return (Rules of Hooks). ───
  const totalEpisodes = anime?.episodes ?? (anime?.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 0);
  const nextAirEp = anime?.nextAiringEpisode?.episode ?? null;
  const filteredEpisodes = useMemo(() => {
    if (!epSearch.trim()) return Array.from({ length: totalEpisodes }, (_, i) => i + 1);
    const n = parseInt(epSearch, 10);
    if (!isNaN(n) && n >= 1 && n <= totalEpisodes) return [n];
    return [];
  }, [epSearch, totalEpisodes]);

  const watchedEpisodes = useMemo(() => {
    const set = new Set<number>();
    if (!anime) return set;
    for (const h of history) {
      if (h.animeId === anime.id) set.add(h.episode);
    }
    return set;
  }, [history, anime]);

  const vibe = useMemo(
    () => (anime ? getVibeLabel(anime.genres, undefined) : null),
    [anime],
  );

  const lastWatchedEp = useMemo(() => {
    if (!anime) return 1;
    if (!history.length) return 1;
    let best = 0;
    let bestTs = 0;
    for (const h of history) {
      if (h.animeId === anime.id && h.updatedAt > bestTs) {
        bestTs = h.updatedAt;
        best = h.episode;
      }
    }
    return best > 0 ? best : 1;
  }, [history, anime]);

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
    setTimeout(() => {
      const el = document.getElementById(`ep-${n}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const scrollChars = (dir: "left" | "right") => {
    const el = charsScrollRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.8, 600);
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  };

  // ─── Early returns come AFTER all hooks (Rules of Hooks). ───
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

  // Now safe to derive non-hook values from `anime`.
  const title = getTitle(anime.title);
  const animationStudios = anime.studios?.nodes?.filter((s) => s.isAnimationStudio) ?? [];
  const studioNames = animationStudios.length > 0
    ? animationStudios.map((s) => s.name)
    : (anime.studios?.nodes ?? []).map((s) => s.name);
  const genres = anime.genres ?? [];
  const bookmarked = isBookmarked(anime.id);
  const coverLarge = anime.coverImage?.large ?? "/placeholder.svg";
  const coverExtra = anime.coverImage?.extraLarge ?? coverLarge;
  const banner = anime.bannerImage || coverExtra;
  const synopsisText = anime.description
    ? anime.description.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "")
    : "";
  const accentColor = anime.coverImage?.color ?? "#e94560";

  return (
    <div className="pb-16">
      {/* ─── Cinematic Hero (redesigned) ─── */}
      <section className="relative">
        {/* Full-bleed banner background with Ken Burns + parallax-style blur */}
        <div className="relative h-[45vh] min-h-[340px] max-h-[520px] w-full overflow-hidden">
          <img
            src={banner}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover scale-105 animate-ken-burns"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          {/* Color tint from cover */}
          <div
            className="absolute inset-0 opacity-30 mix-blend-soft-light"
            style={{
              background: `radial-gradient(circle at 30% 50%, ${accentColor} 0%, transparent 70%)`,
            }}
          />
          {/* Strong gradient overlays for legibility — bottom + left */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
          {/* Subtle grain */}
          <div className="absolute inset-0 grain-overlay" />
        </div>

        {/* Content overlay — pulled up over the banner */}
        <div className="max-w-7xl mx-auto px-4 md:px-6 -mt-40 md:-mt-48 lg:-mt-56 relative z-10">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5 glass px-3 py-1.5 rounded-full"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>

          <div className="flex flex-col md:flex-row gap-6 md:gap-10">
            {/* Cover image with glow + floating effect */}
            <div className="flex-shrink-0 mx-auto md:mx-0 relative">
              <div
                className="absolute -inset-3 rounded-2xl blur-xl opacity-60"
                style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}33)` }}
              />
              <img
                src={coverLarge}
                alt={title}
                className="relative w-40 h-56 sm:w-44 sm:h-64 md:w-48 md:h-72 lg:w-52 lg:h-80 rounded-2xl object-cover border-2 border-white/10 shadow-[0_25px_70px_rgba(0,0,0,0.7)]"
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
              />
              {/* Score badge floating on cover corner */}
              {anime.averageScore != null && (
                <div className="absolute -top-3 -right-3 flex items-center gap-1 px-3 py-1.5 rounded-full glass-strong text-white shadow-lg">
                  <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                  <span className="font-bold text-sm">{Math.round(anime.averageScore)}%</span>
                </div>
              )}
            </div>

            {/* Title + meta */}
            <div className="flex-1 space-y-4 md:pt-16 lg:pt-24 text-center md:text-left">
              {/* Vibe + genres row */}
              <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start">
                {vibe && (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-xan-crimson/20 to-xan-violet/20 border border-xan-crimson/30 text-foreground"
                    title={`Inferred from genres: ${genres.join(", ")}`}
                  >
                    <span>{vibe.emoji}</span>
                    {vibe.label}
                  </span>
                )}
                {genres.slice(0, 3).map((g) => (
                  <span
                    key={g}
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-medium glass text-muted-foreground uppercase tracking-wide"
                  >
                    {g}
                  </span>
                ))}
              </div>

              <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold font-display text-foreground leading-[1.05] drop-shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                {title}
              </h1>

              {/* Romaji subtitle if different from english */}
              {anime.title.english && anime.title.romaji && anime.title.english !== anime.title.romaji && (
                <p className="text-sm md:text-base text-muted-foreground italic">
                  {anime.title.romaji}
                </p>
              )}

              {/* Stats row — pill chips */}
              <div className="flex flex-wrap items-center gap-2 text-sm justify-center md:justify-start">
                {anime.seasonYear && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-foreground">
                    <Calendar className="h-3.5 w-3.5 text-xan-crimson" />
                    {anime.season
                      ? `${anime.season.charAt(0)}${anime.season.slice(1).toLowerCase()} ${anime.seasonYear}`
                      : anime.seasonYear}
                  </span>
                )}
                {anime.episodes != null && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-foreground">
                    <Tv className="h-3.5 w-3.5 text-xan-crimson" />
                    {anime.episodes} eps
                  </span>
                )}
                {anime.format && (
                  <span className="px-3 py-1.5 rounded-full glass text-[11px] font-medium tracking-wider uppercase text-foreground">
                    {anime.format}
                  </span>
                )}
                {anime.status && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-foreground">
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

              {/* Action buttons row */}
              <div className="flex items-center gap-2.5 pt-2 flex-wrap justify-center md:justify-start">
                <Link
                  to={`/watch/${anime.id}?ep=1`}
                  className="btn-premium inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-violet hover:opacity-90 font-semibold text-white transition-all shadow-lg shadow-xan-crimson/30"
                >
                  <Play className="h-4 w-4 fill-white" /> Watch Now
                </Link>
                <AnimeStatusButton
                  animeId={anime.id}
                  title={title}
                  coverImage={coverLarge}
                />
                <button
                  onClick={() =>
                    toggleBookmark({
                      animeId: anime.id,
                      title,
                      coverImage: coverLarge,
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

              {/* Next airing countdown — inline pill */}
              {anime.nextAiringEpisode && <NextAiringCard anime={anime} />}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Content sections (redesigned 2/3 + 1/3 split) ─── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 mt-12 md:mt-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Main column (2/3) */}
          <div className="lg:col-span-2 space-y-12">
            {/* Synopsis — redesigned card */}
            {synopsisText && (
              <section className="animate-fade-in-up">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
                  <h2 className="text-xl font-bold font-display text-foreground">Synopsis</h2>
                </div>
                <div className="glass rounded-2xl p-6 md:p-7 relative overflow-hidden">
                  {/* Accent corner glow */}
                  <div
                    className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10 blur-3xl"
                    style={{ background: accentColor }}
                  />
                  <p
                    className={`relative text-sm md:text-base text-muted-foreground leading-relaxed ${
                      synopsisExpanded ? "" : "line-clamp-4"
                    }`}
                  >
                    {synopsisText}
                  </p>
                  {synopsisText.length > 200 && (
                    <button
                      type="button"
                      onClick={() => setSynopsisExpanded((v) => !v)}
                      className="relative mt-3 inline-flex items-center gap-1 text-xs font-semibold text-xan-crimson hover:text-xan-crimson-dark transition-colors"
                      aria-expanded={synopsisExpanded}
                    >
                      {synopsisExpanded ? "Show less" : "Read more"}
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform ${synopsisExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* Episodes (redesigned) */}
            <section className="animate-fade-in-up">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
                  <h2 className="text-xl font-bold font-display text-foreground">Episodes</h2>
                  {totalEpisodes > 0 && (
                    <span className="text-xs text-muted-foreground ml-1">{totalEpisodes} total</span>
                  )}
                </div>
                {totalEpisodes > EPISODES_PER_PAGE && (
                  <span className="text-xs text-muted-foreground">
                    Page {safePage} of {totalPages}
                  </span>
                )}
              </div>

              {/* Mobile-only: button to open the bottom-sheet episode picker */}
              {totalEpisodes > 0 && (
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="md:hidden mb-4 w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl glass border border-xan-border hover:border-xan-crimson/40 text-sm font-medium text-foreground transition-all"
                >
                  <span className="flex items-center gap-2">
                    <List className="h-4 w-4 text-xan-crimson" />
                    Browse {totalEpisodes} episode{totalEpisodes > 1 ? "s" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">Tap to open</span>
                </button>
              )}

              {totalEpisodes > 0 ? (
                <>
                  {/* Desktop search + grid + pagination */}
                  <div className="hidden md:block">
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
                            className={`group aspect-square flex flex-col items-center justify-center rounded-xl glass border text-sm font-medium transition-all hover-lift relative overflow-hidden ${
                              watchedEpisodes.has(ep)
                                ? "border-xan-crimson/40 bg-xan-crimson/5"
                                : "border-xan-border hover:border-xan-crimson/50"
                            }`}
                            title={watchedEpisodes.has(ep) ? `Episode ${ep} — watched` : `Episode ${ep}`}
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-xan-crimson/10 to-xan-violet/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="relative">{ep}</span>
                            {watchedEpisodes.has(ep) && (
                              <span
                                className="absolute top-0.5 right-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-xan-crimson text-white"
                                title="Watched"
                              >
                                <Check className="h-2 w-2" />
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>

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
                  </div>
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

            {/* Characters — redesigned prominent side-scroll with arrows */}
            {anime.characters?.nodes?.length > 0 && (
              <section className="animate-fade-in-up">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
                    <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
                      <Users className="h-5 w-5 text-xan-crimson" />
                      Characters
                    </h2>
                    <span className="text-xs text-muted-foreground ml-1">
                      {anime.characters.nodes.length}
                    </span>
                  </div>
                  {/* Scroll arrows (desktop) */}
                  <div className="hidden md:flex items-center gap-2">
                    <button
                      onClick={() => scrollChars("left")}
                      aria-label="Scroll characters left"
                      className="rounded-full glass border border-xan-border hover:bg-white/10 h-8 w-8 flex items-center justify-center transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => scrollChars("right")}
                      aria-label="Scroll characters right"
                      className="rounded-full glass border border-xan-border hover:bg-white/10 h-8 w-8 flex items-center justify-center transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Horizontal scroller — larger cards, mask-fade edges */}
                <div className="relative">
                  <div
                    ref={charsScrollRef}
                    className="flex gap-4 overflow-x-auto no-scrollbar pb-3 -mx-2 px-2 mask-fade-edges snap-x snap-mandatory"
                  >
                    {anime.characters.nodes.map((c, idx) => (
                      <div
                        key={c.id}
                        className="w-32 sm:w-36 md:w-40 shrink-0 group card-enter snap-start"
                        style={{ "--card-index": Math.min(idx, 10) } as React.CSSProperties}
                      >
                        <div className="relative aspect-[3/4] rounded-xl overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all shadow-lg">
                          <img
                            src={c.image?.large ?? "/placeholder.svg"}
                            alt={c.name?.full ?? "Character"}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/30 to-transparent" />
                          <div className="absolute bottom-0 left-0 right-0 p-3">
                            <p className="text-xs font-semibold text-white line-clamp-2 leading-tight drop-shadow">
                              {c.name?.full ?? "Unknown"}
                            </p>
                          </div>
                          {/* Hover play-style accent */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div
                              className="w-3 h-3 rounded-full bg-xan-crimson"
                              style={{ boxShadow: `0 0 20px ${accentColor}` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar (1/3) — redesigned */}
          <aside className="space-y-8">
            {/* Information card — redesigned */}
            <section className="animate-fade-in-up">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
                <h2 className="text-xl font-bold font-display text-foreground">Information</h2>
              </div>
              <div className="glass rounded-2xl p-5 space-y-1">
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

            {/* Relations — redesigned separate section */}
            {anime.relations?.nodes?.length > 0 && (
              <section className="animate-fade-in-up">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
                  <h2 className="text-xl font-bold font-display text-foreground">Related</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {anime.relations.nodes.slice(0, 4).map((r) => (
                    <Link key={`r-${r.id}`} to={`/anime/${r.id}`} className="group hover-lift">
                      <div className="aspect-[2/3] rounded-xl overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all relative shadow-lg">
                        <img
                          src={r.coverImage?.large ?? "/placeholder.svg"}
                          alt={getTitle(r.title)}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                        <p className="absolute bottom-2 left-2 right-2 text-[10px] font-medium text-white line-clamp-2 leading-tight">
                          {getTitle(r.title)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Recommendations — redesigned separate section */}
            {anime.recommendations?.nodes?.length > 0 && (
              <section className="animate-fade-in-up">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-1 h-6 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
                  <h2 className="text-xl font-bold font-display text-foreground">Recommended</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {anime.recommendations.nodes.slice(0, 4).map((r) => (
                    <Link key={`rec-${r.mediaRecommendation.id}`} to={`/anime/${r.mediaRecommendation.id}`} className="group hover-lift">
                      <div className="aspect-[2/3] rounded-xl overflow-hidden border border-xan-border group-hover:border-xan-crimson/50 transition-all relative shadow-lg">
                        <img
                          src={r.mediaRecommendation.coverImage?.large ?? "/placeholder.svg"}
                          alt={getTitle(r.mediaRecommendation.title)}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                        <p className="absolute bottom-2 left-2 right-2 text-[10px] font-medium text-white line-clamp-2 leading-tight">
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

      {/* Mobile bottom-sheet episode picker */}
      <EpisodePickerSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        animeId={anime.id}
        currentEpisode={lastWatchedEp}
        totalEpisodes={totalEpisodes}
        nextAirEp={nextAirEp}
      />
    </div>
  );
}

function NextAiringCard({ anime }: { anime: AnimeDetail }) {
  const now = useCountdownTick();
  if (!anime.nextAiringEpisode) return null;
  const airingAt = anime.nextAiringEpisode.airingAt * 1000;
  const remaining = Math.max(0, Math.floor((airingAt - now) / 1000));
  return (
    <div className="inline-flex items-center gap-3 glass rounded-full pl-2 pr-4 py-2 max-w-md animate-fade-in-up">
      <div className="w-8 h-8 rounded-full bg-xan-crimson/20 flex items-center justify-center flex-shrink-0">
        <Clock className="h-4 w-4 text-xan-crimson" />
      </div>
      <div className="text-left">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Next Episode</p>
        <p className="text-xs font-semibold text-foreground">
          EP {anime.nextAiringEpisode.episode} •{" "}
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
    <div className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg hover:bg-xan-card/50 transition-colors">
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
