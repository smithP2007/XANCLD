import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Flame, TrendingUp, Sparkles, Heart, Calendar, History as HistoryIcon } from "lucide-react";
import {
  fetchTrending,
  fetchPopular,
  fetchAnimeDetail,
  fetchSchedule,
  type AnimeCard as AnimeCardType,
  type AiringAnime,
} from "../lib/anilist";
import { AnimeCard } from "../components/AnimeCard";
import { AnimeCardSkeleton } from "../components/AnimeCardSkeleton";
import { HeroCarousel } from "../components/HeroCarousel";
import { ContinueWatching } from "../components/ContinueWatching";
import { SectionRow } from "../components/SectionRow";
import { HomeGreeting } from "../components/HomeGreeting";
import { MoodChips } from "../components/MoodChips";
import { EpisodeCountdown } from "../components/EpisodeCountdown";
import { Reveal } from "../components/Reveal";
import { ErrorState } from "../components/ErrorState";
import { useBookmarks } from "../hooks/useBookmarks";
import { useAnimeList } from "../hooks/useAnimeList";
import { useSettings, useWatchHistory } from "../hooks/useSettings";
import { recommendFromSeed, type ScoredRecommendation, type Mood, type DurationPref } from "../lib/recommend";

// v4.2.1: all sections RESTORED per user request ("revert Removed
// (unnecessary) from home page, but keep SUNDEEP") — the page is back to
// its full form: Hero, Continue Watching, Airing Today, Because you saved,
// Trending, Recommendations, Popular, More to Explore. The SUNDEEP
// signature stays at the bottom-right corner.
// v4.3 LIVELY (user request: "make the home screen more lively"):
//   • ambient gradient blobs drift slowly behind the whole feed (frozen
//     under reduced-motion / TV mode)
//   • the hero casts a soft glow in the ACTIVE slide's dominant color —
//     HeroCarousel.onActiveChange is finally wired up
//   • every section scroll-reveals via the new Reveal wrapper
//   • Airing Today carries a LIVE badge with a pulsing dot; section
//     diamonds breathe; hero progress segments fill in sync with the
//     7s auto-advance (HeroCarousel + SectionRow + index.css v4.3 block)
// v4.4 ENGAGING (user request: "make it more engaging home page"):
//   • time-aware personal greeting ("Good evening.") with LIVE stats
//     (in progress / saved / episodes watched) and a staggered rise-in
//   • "Surprise Me" — dice rolls a random pick out of trending+popular
//     and navigates to its detail page
//   • MoodChips — one-tap genre chips deep-linking into /search?genres=…
//   • Airing Today cards wear LIVE ticking countdown chips (shared 1s
//     tick hook) that turn crimson within an hour of air

export function Home() {
  const [trending, setTrending] = useState<AnimeCardType[]>([]);
  const [popular, setPopular] = useState<AnimeCardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { bookmarks } = useBookmarks();
  const { list: animeList } = useAnimeList();
  const history = useWatchHistory();
  const [settings] = useSettings();
  const [recs, setRecs] = useState<ScoredRecommendation[]>([]);
  const [recsSeed, setRecsSeed] = useState<string | null>(null);
  // Watch-history-based recommendations — collects the top 5 unique anime
  // from watch history, fetches each one's AniList recommendations, merges +
  // dedupes + re-scores them into a single "Recommendations" row.
  const [historyRecs, setHistoryRecs] = useState<ScoredRecommendation[]>([]);
  const [historyRecsCount, setHistoryRecsCount] = useState(0);
  // "Airing Today" row (redesign plan §4) — reuses fetchSchedule.
  const [airingToday, setAiringToday] = useState<AiringAnime[]>([]);

  // v4.3 LIVELY — dominant color of the active hero slide; drives the soft
  // glow bleeding around the hero card (null until the first slide lands).
  const [heroColor, setHeroColor] = useState<string | null>(null);
  // Ambient motion is dropped entirely for reduced-motion / TV-mode users.
  const ambientStill = settings.reducedMotion || settings.tvMode;

  // v4.4 ENGAGING — "Surprise Me" rolls a random pick from trending+popular.
  // The dice dances for ~0.55s before navigating so the micro-interaction
  // reads; the timer ref is cleaned up if the user leaves mid-roll.
  const [shuffling, setShuffling] = useState(false);
  const surpriseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    return () => {
      if (surpriseTimer.current) clearTimeout(surpriseTimer.current);
    };
  }, []);

  const handleSurprise = () => {
    if (shuffling) return;
    const pool = [...trending, ...popular];
    if (pool.length === 0) return;
    setShuffling(true);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    surpriseTimer.current = setTimeout(() => navigate(`/anime/${pick.id}`), 550);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch trending + popular + schedule in parallel. fetchSchedule now
        // paginates internally (up to 5 pages = 250 anime) to get ALL
        // currently-airing shows, not just the top 50.
        const [t, p, sched] = await Promise.all([
          fetchTrending(10),
          fetchPopular(18),
          fetchSchedule(50),
        ]);
        setTrending(t);
        setPopular(p);
        // Filter schedule to episodes airing TODAY (calendar-date equality).
        // M-4 FIX: this used to compare only the day-of-WEEK, so any weekly
        // episode airing within the next 7 days on the same weekday matched —
        // e.g. a show whose latest episode aired this morning has its NEXT
        // episode exactly 7 days out, same weekday → wrongly listed in
        // "Airing Today" with a ~7-day countdown.
        // No artificial slice cap — show ALL shows airing today, sorted by
        // airing time. The SectionRow handles horizontal scrolling so a long
        // list is fine.
        const todayStr = new Date().toDateString();
        setAiringToday(
          sched
            .filter((a) => a.nextAiringEpisode && new Date(a.nextAiringEpisode.airingAt * 1000).toDateString() === todayStr)
            .sort((a, b) => (a.nextAiringEpisode!.airingAt - b.nextAiringEpisode!.airingAt)),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // "Because you saved" — pick the most-recent bookmark, fetch its AniList
  // detail (which already returns `recommendations`), then score those
  // candidates with recommendFromSeed against local signals.
  //
  // DEPENDENCY STABILITY: useBookmarks/useAnimeList return new array
  // identities on every state change, which would cause this effect to
  // refetch on every render. To avoid that, we derive stable string
  // signatures (sorted IDs + counts) and depend on those instead.
  const bookmarkSig = useMemo(
    () => bookmarks.map((b) => b.animeId).join(","),
    [bookmarks],
  );
  const listSig = useMemo(
    () => animeList.map((e) => `${e.animeId}:${e.status}`).join(","),
    [animeList],
  );
  // Stable signature for watch history — most-recent first (useWatchHistory
  // returns entries sorted by updatedAt desc). We include the animeId + ep
  // so the effect re-runs when the user watches a new episode of the same
  // show (and thus may want fresh recs).
  const historySig = useMemo(
    () => history.slice(0, 5).map((h) => `${h.animeId}:${h.episode}`).join(","),
    [history],
  );

  useEffect(() => {
    if (bookmarks.length === 0) {
      setRecs([]);
      setRecsSeed(null);
      return;
    }
    const seed = bookmarks[0]; // most-recent first (useBookmarks prepends)
    let cancelled = false;
    (async () => {
      try {
        const detail = await fetchAnimeDetail(seed.animeId);
        if (cancelled || !detail) return;
        const candidates = detail.recommendations?.nodes
          ?.map((n) => n.mediaRecommendation)
          .filter((c): c is AnimeCardType => !!c) ?? [];
        const scored = recommendFromSeed(candidates, {
          bookmarks,
          animeList,
          recentlyViewed: [],
          signalGenres: detail.genres,
          moodPreference:
            settings.moodPreference && settings.moodPreference !== "surprise"
              ? (settings.moodPreference as Mood)
              : undefined,
          durationPreference:
            settings.durationPreference && settings.durationPreference !== "any"
              ? (settings.durationPreference as DurationPref)
              : undefined,
        });
        if (!cancelled) {
          setRecs(scored);
          setRecsSeed(seed.title);
        }
      } catch {
        // Recommendations are best-effort — never block the Home page.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookmarkSig, listSig, settings.moodPreference, settings.durationPreference]);

  // ─── Recommendations row ───
  // Collects the top 5 unique anime from watch history (most-recent first),
  // fetches each one's AniList detail in parallel to gather recommendations,
  // then merges + dedupes + re-scores all candidates into a single row.
  // This gives a broader "shows you might like" row based on everything
  // you've been watching, not just the single most-recent show.
  useEffect(() => {
    if (history.length === 0) {
      setHistoryRecs([]);
      setHistoryRecsCount(0);
      return;
    }
    // Dedupe by animeId (history can have multiple episodes of the same show)
    // and take the top 5 unique shows, most-recent first.
    const seenIds = new Set<number>();
    const seeds = history
      .filter((h) => {
        if (seenIds.has(h.animeId)) return false;
        seenIds.add(h.animeId);
        return true;
      })
      .slice(0, 5);
    setHistoryRecsCount(seeds.length);

    let cancelled = false;
    (async () => {
      try {
        // Fetch detail for each seed anime in parallel — each returns its
        // own recommendations list + genres (used as the signalGenres for
        // scoring candidates from that seed).
        const details = await Promise.all(
          seeds.map((s) => fetchAnimeDetail(s.animeId).catch(() => null)),
        );

        // Merge all candidates from all seeds into one pool. Build a map
        // of animeId -> signalGenres so we can score each candidate against
        // the genres of the seed that recommended it (and boost candidates
        // that appear across multiple seeds — those are stronger recs).
        const candidateMap = new Map<number, AnimeCardType>();
        const candidateGenreSignals = new Map<number, string[]>();
        const candidateSeedCount = new Map<number, number>();

        for (const detail of details) {
          if (!detail?.recommendations?.nodes) continue;
          for (const node of detail.recommendations.nodes) {
            const c = node.mediaRecommendation;
            if (!c) continue;
            if (!candidateMap.has(c.id)) {
              candidateMap.set(c.id, c);
              candidateGenreSignals.set(c.id, detail.genres ?? []);
              candidateSeedCount.set(c.id, 1);
            } else {
              // Candidate recommended by multiple seeds — boost its seed count
              candidateSeedCount.set(c.id, (candidateSeedCount.get(c.id) ?? 1) + 1);
              // Merge genre signals (union of all recommending seeds' genres)
              const existing = candidateGenreSignals.get(c.id) ?? [];
              const merged = Array.from(new Set([...existing, ...(detail.genres ?? [])]));
              candidateGenreSignals.set(c.id, merged);
            }
          }
        }

        // Exclude anime the user is already watching or has bookmarked —
        // no point recommending shows they're already on.
        const excludeIds = new Set<number>([
          ...bookmarks.map((b) => b.animeId),
          ...animeList.map((e) => e.animeId),
          ...seeds.map((s) => s.animeId),
        ]);

        // Score each candidate. Candidates recommended by multiple seeds
        // get a bonus per extra seed (cross-show agreement = stronger rec).
        const scored: ScoredRecommendation[] = [];
        for (const [id, anime] of candidateMap) {
          if (excludeIds.has(id)) continue;
          const signalGenres = candidateGenreSignals.get(id) ?? [];
          const seedCount = candidateSeedCount.get(id) ?? 1;
          const { score, reason } = (function scoreCandidate() {
            // Inline scoring using the same logic as recommend.ts scoreAnime
            // but with the cross-seed bonus. We call recommendFromSeed with
            // a single-element array to reuse the existing scoring logic,
            // then add the bonus.
            const single = recommendFromSeed([anime], {
              bookmarks,
              animeList,
              recentlyViewed: [],
              signalGenres,
              moodPreference:
                settings.moodPreference && settings.moodPreference !== "surprise"
                  ? (settings.moodPreference as Mood)
                  : undefined,
              durationPreference:
                settings.durationPreference && settings.durationPreference !== "any"
                  ? (settings.durationPreference as DurationPref)
                  : undefined,
            });
            return single[0] ?? { anime, score: 0, reason: "Recommended for you" };
          })();
          // Bonus: +2 per additional seed that recommended this candidate
          // (cross-show agreement is a strong signal).
          const bonusScore = (seedCount - 1) * 2;
          const finalScore = score + bonusScore;
          if (finalScore > 0) {
            scored.push({
              anime,
              score: finalScore,
              reason: seedCount > 1
                ? `Recommended by ${seedCount} of your recent shows`
                : reason,
            });
          }
        }

        // Sort by score descending, take top 18 for the row
        scored.sort((a, b) => b.score - a.score);
        if (!cancelled) {
          setHistoryRecs(scored.slice(0, 18));
        }
      } catch {
        // Best-effort — never block the Home page.
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historySig, listSig, settings.moodPreference, settings.durationPreference]);

  // Hero skeleton
  if (loading && trending.length === 0) {
    return (
      <div className="relative">
        {/* Skeleton hero — mirrors the real hero's container (max-w-7xl,
            same padding/height/radius) so loading doesn't shift the page */}
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6 md:pt-6">
          <section className="relative h-[52vh] min-h-[380px] max-h-[560px] w-full overflow-hidden rounded-[24px] border border-xan-border md:h-[56vh] md:min-h-[430px] md:rounded-[32px]">
            <div className="absolute inset-0 bg-gradient-to-br from-xan-card via-xan-dark to-xan-dark animate-shimmer" />
            <div className="relative h-full px-6 flex items-center">
              <div className="space-y-4 w-full max-w-2xl">
                <div className="h-4 w-32 bg-white/10 rounded-full animate-shimmer" />
                <div className="h-14 w-3/4 bg-white/10 rounded-2xl animate-shimmer" />
                <div className="h-4 w-1/2 bg-white/5 rounded-full animate-shimmer" />
                <div className="flex gap-3 pt-2">
                  <div className="h-11 w-32 bg-white/10 rounded-full animate-shimmer" />
                  <div className="h-11 w-28 bg-white/5 rounded-full animate-shimmer" />
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-10 space-y-10">
          <section className="space-y-4">
            <div className="h-8 w-40 bg-xan-card rounded animate-shimmer" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 12 }, (_, i) => (
                <AnimeCardSkeleton key={i} />
              ))}
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (error && trending.length === 0) {
    return (
      <ErrorState
        message="Couldn't load the home feed"
        description="AniList might be rate-limiting or temporarily unreachable. Try again in a moment."
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="relative">
      {/* ─── v4.3 ambient layers (z-0) — every content wrapper sits z-[1] ─── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[170vh] overflow-hidden">
        {/* Drifting gradient blobs — frozen (no animate classes) under
            reduced-motion / TV mode */}
        <div
          className={`xan-blob left-[-12%] top-[-4%] h-[460px] w-[560px] opacity-[0.13] ${ambientStill ? "" : "animate-mesh"}`}
          style={{ background: "radial-gradient(closest-side, var(--color-xan-crimson), transparent)" }}
        />
        <div
          className={`xan-blob right-[-14%] top-[22%] h-[520px] w-[620px] opacity-[0.12] ${ambientStill ? "" : "animate-mesh-2"}`}
          style={{ background: "radial-gradient(closest-side, var(--color-xan-violet), transparent)" }}
        />
        <div
          className={`xan-blob left-[6%] top-[56%] h-[420px] w-[480px] opacity-[0.08] ${ambientStill ? "" : "animate-mesh-2"}`}
          style={{ background: "radial-gradient(closest-side, var(--color-xan-violet), transparent)" }}
        />
        {/* Hero glow — the active slide's dominant color bleeding around
            the hero card; gently crossfades on each slide change */}
        {heroColor && (
          <div
            key={heroColor}
            className="animate-fade-in absolute left-1/2 top-0 h-[520px] w-[min(92vw,880px)] -translate-x-1/2 rounded-full opacity-20 blur-[110px]"
            style={{ background: `radial-gradient(closest-side, ${heroColor}, transparent)` }}
          />
        )}
      </div>

      <div className="relative z-[1]">
        {/* Hero — v4: contained card below the rail (no negative offset) */}
        {trending.length > 0 && <HeroCarousel anime={trending} onActiveChange={setHeroColor} />}
      </div>

      <div className="relative z-[1] max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-14 space-y-10 md:space-y-14">
        {/* v4.4 — personal greeting + mood chips (one Reveal so they rise as
            a single unit; internal elements stagger via greet-in delays) */}
        <Reveal>
          <HomeGreeting
            inProgress={animeList.filter((e) => e.status === "WATCHING").length}
            saved={bookmarks.length}
            episodes={history.length}
            onSurprise={handleSurprise}
            shuffling={shuffling}
          />
          <MoodChips />
        </Reveal>

        {/* Continue Watching (auto-hides if empty) */}
        <Reveal>
          <ContinueWatching />
        </Reveal>

        {/* Airing Today (redesign plan §4: reuse Schedule's fetchSchedule).
            Hidden if no shows air today (e.g. late-night weekend). */}
        {airingToday.length > 0 && (
          <Reveal>
          <SectionRow
            title="Airing Today"
            subtitle="New episodes dropping today"
            badge="Live"
            icon={<Calendar className="h-4 w-4 text-xan-crimson" />}
          >
            {airingToday.map((a, idx) => (
              <div
                key={a.id}
                className="relative flex-shrink-0 w-[150px] sm:w-[170px] md:w-[180px] snap-start"
              >
                {/* v4.4 — live ticking countdown chip over the poster */}
                {a.nextAiringEpisode && (
                  <EpisodeCountdown
                    episode={a.nextAiringEpisode.episode}
                    airingAt={a.nextAiringEpisode.airingAt}
                  />
                )}
                <AnimeCard anime={a} index={idx} />
              </div>
            ))}
          </SectionRow>
          </Reveal>
        )}

        {/* Because you saved — local recommendations row (redesign plan §4/§5).
            Hidden when there are no bookmarks or no scored recommendations. */}
        {recs.length > 0 && recsSeed && (
          <Reveal>
          <SectionRow
            title="Because you saved"
            subtitle={`Based on "${recsSeed}" — scored locally from your bookmarks and lists`}
            icon={<Heart className="h-4 w-4 text-xan-crimson fill-xan-crimson" />}
          >
            {recs.map((r, idx) => (
              <div
                key={r.anime.id}
                className="flex-shrink-0 w-[150px] sm:w-[170px] md:w-[180px] snap-start"
              >
                <AnimeCard anime={r.anime} index={idx} />
              </div>
            ))}
          </SectionRow>
          </Reveal>
        )}

        {/* Trending row */}
        {trending.length > 0 && (
          <Reveal>
          <SectionRow
            title="Trending Now"
            subtitle="The hottest anime right now"
            icon={<TrendingUp className="h-4 w-4 text-xan-crimson" />}
          >
            {trending.map((a, idx) => (
              <div
                key={a.id}
                className="flex-shrink-0 w-[150px] sm:w-[170px] md:w-[180px] snap-start"
              >
                <AnimeCard anime={a} index={idx} />
              </div>
            ))}
          </SectionRow>
          </Reveal>
        )}

        {/* Recommendations — collects top 5 unique anime from watch history,
            fetches each one's AniList recommendations, merges + dedupes +
            re-scores into a single row. Hidden when there's no watch history
            or no scored recommendations. */}
        {historyRecs.length > 0 && (
          <Reveal>
          <SectionRow
            title="Recommendations"
            subtitle={
              historyRecsCount > 0
                ? `Based on your last ${historyRecsCount} watched ${historyRecsCount === 1 ? "show" : "shows"}`
                : "Based on your watch history"
            }
            icon={<HistoryIcon className="h-4 w-4 text-xan-crimson" />}
          >
            {historyRecs.map((r, idx) => (
              <div
                key={r.anime.id}
                className="flex-shrink-0 w-[150px] sm:w-[170px] md:w-[180px] snap-start"
              >
                <AnimeCard anime={r.anime} index={idx} />
              </div>
            ))}
          </SectionRow>
          </Reveal>
        )}

        {/* Popular row */}
        {popular.length > 0 && (
          <Reveal>
          <SectionRow
            title="Popular Anime"
            subtitle="All-time most watched"
            icon={<Sparkles className="h-4 w-4 text-xan-crimson" />}
          >
            {popular.map((a, idx) => (
              <div
                key={a.id}
                className="flex-shrink-0 w-[150px] sm:w-[170px] md:w-[180px] snap-start"
              >
                <AnimeCard anime={a} index={idx} />
              </div>
            ))}
          </SectionRow>
          </Reveal>
        )}

        {/* Top picks grid — flat grid of popular anime */}
        {popular.length > 6 && (
          <Reveal>
          <section className="space-y-4">
            <div>
              <h2 className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-foreground md:text-2xl">
                <span className="section-diamond h-2.5 w-2.5 shrink-0 rotate-45 rounded-[4px] bg-gradient-to-br from-xan-crimson to-xan-violet" />
                More to Explore
              </h2>
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground">
                <Flame className="h-3.5 w-3.5 text-xan-crimson" />
                Discover something new
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {popular.slice(6).map((a, idx) => (
                <AnimeCard key={a.id} anime={a} index={idx} />
              ))}
            </div>
          </section>
          </Reveal>
        )}

        {/* ─── Signature — SUNDEEP, bottom-right corner of the home page ─── */}
        <Reveal>
        <div
          className="flex items-center justify-end gap-2.5 pt-2 select-none"
          aria-hidden="true"
        >
          <span className="h-px w-10 bg-gradient-to-l from-xan-crimson/50 to-transparent" />
          <span className="font-display text-[11px] font-extrabold uppercase tracking-[0.38em] text-muted-foreground/70">
            SUNDEEP
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-xan-crimson to-xan-violet" />
        </div>
        </Reveal>
      </div>
    </div>
  );
}
