import { useState, useEffect, useMemo } from "react";
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
import { ErrorState } from "../components/ErrorState";
import { useBookmarks } from "../hooks/useBookmarks";
import { useAnimeList } from "../hooks/useAnimeList";
import { useSettings, useWatchHistory } from "../hooks/useSettings";
import { recommendFromSeed, type ScoredRecommendation, type Mood, type DurationPref } from "../lib/recommend";

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch trending + popular + schedule in parallel. Schedule powers
        // both the "Airing Today" row here and the Schedule page (single
        // shared fetchSchedule, no duplicate fetch logic).
        //
        // We fetch 50 (not 30) for the schedule because the previous 30-item
        // cap + TRENDING_DESC sort meant many currently-airing shows were
        // cut off before reaching the "Airing Today" filter. 50 is AniList's
        // practical per-page limit for a single request without pagination.
        const [t, p, sched] = await Promise.all([
          fetchTrending(10),
          fetchPopular(18),
          fetchSchedule(50),
        ]);
        setTrending(t);
        setPopular(p);
        // Filter schedule to episodes airing today (by local day-of-week).
        // No artificial slice cap — show ALL shows airing today, sorted by
        // airing time. The SectionRow handles horizontal scrolling so a long
        // list is fine.
        const today = new Date().getDay();
        setAiringToday(
          sched
            .filter((a) => a.nextAiringEpisode && new Date(a.nextAiringEpisode.airingAt * 1000).getDay() === today)
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
          hidden: [],
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
              hidden: [],
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
        <section className="relative w-full h-[58vh] min-h-[420px] max-h-[560px] md:h-[78vh] md:min-h-[520px] md:max-h-[760px] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-xan-card via-xan-dark to-xan-dark animate-shimmer" />
          <div className="relative h-full max-w-7xl mx-auto px-4 md:px-6 flex items-center pb-16 md:pb-20">
            <div className="space-y-4 w-full max-w-2xl">
              <div className="h-4 w-32 bg-white/10 rounded animate-shimmer" />
              <div className="h-16 w-3/4 bg-white/10 rounded animate-shimmer" />
              <div className="h-4 w-1/2 bg-white/5 rounded animate-shimmer" />
              <div className="flex gap-3 pt-2">
                <div className="h-12 w-36 bg-white/10 rounded-full animate-shimmer" />
                <div className="h-12 w-32 bg-white/5 rounded-full animate-shimmer" />
              </div>
            </div>
          </div>
        </section>
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
    <div className="relative -mt-16">
      {/* Hero */}
      {trending.length > 0 && <HeroCarousel anime={trending} />}

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-14 space-y-10 md:space-y-14">
        {/* Continue Watching (auto-hides if empty) */}
        <ContinueWatching />

        {/* Airing Today (redesign plan §4: reuse Schedule's fetchSchedule).
            Hidden if no shows air today (e.g. late-night weekend). */}
        {airingToday.length > 0 && (
          <SectionRow
            title="Airing Today"
            subtitle="New episodes dropping today"
            icon={<Calendar className="h-4 w-4 text-xan-crimson" />}
          >
            {airingToday.map((a, idx) => (
              <div
                key={a.id}
                className="flex-shrink-0 w-[150px] sm:w-[170px] md:w-[180px] snap-start"
              >
                <AnimeCard anime={a} index={idx} />
              </div>
            ))}
          </SectionRow>
        )}

        {/* Because you saved — local recommendations row (redesign plan §4/§5).
            Hidden when there are no bookmarks or no scored recommendations. */}
        {recs.length > 0 && recsSeed && (
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
        )}

        {/* Trending row */}
        {trending.length > 0 && (
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
        )}

        {/* Recommendations — collects top 5 unique anime from watch history,
            fetches each one's AniList recommendations, merges + dedupes +
            re-scores into a single row. Hidden when there's no watch history
            or no scored recommendations. */}
        {historyRecs.length > 0 && (
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
        )}

        {/* Popular row */}
        {popular.length > 0 && (
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
        )}

        {/* Top picks grid — flat grid of popular anime */}
        {popular.length > 6 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-7 rounded-full bg-gradient-to-b from-xan-crimson to-xan-violet" />
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-xan-crimson/15 to-xan-violet/15 border border-xan-border flex items-center justify-center">
                <Flame className="h-4 w-4 text-xan-crimson" />
              </div>
              <div>
                <h2 className="text-base md:text-xl font-bold font-display text-foreground">
                  More to Explore
                </h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">Discover something new</p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {popular.slice(6).map((a, idx) => (
                <AnimeCard key={a.id} anime={a} index={idx} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
