/**
 * recommend.ts — rules-based local recommendation scoring.
 *
 * Per the redesign plan §5: a pure function that scores candidate anime
 * against the user's local signals and returns the top N with a
 * human-readable reason.
 *
 * Per the plan critique (#4):
 *   - Genre overlap is included but tagged as a coarse signal (most Shounen
 *     share Action/Adventure/Comedy, so it's a weak discriminator alone).
 *   - Filters out COMPLETED titles (don't re-recommend finished shows).
 *   - Excludes hidden IDs with a large negative score (effectively exclude).
 *   - Suppresses titles the user already dismissed recently unless they're
 *     currently in-progress (avoid re-suggesting dismissed titles).
 *   - Trending is only a small tie-breaker, not a primary signal.
 *
 * NOTE on signalGenres: the existing BookmarkEntry and ListEntry types
 * store only animeId/title/coverImage — they don't carry genres. Rather
 * than silently pretending they do (which was the dead code in v1), the
 * caller passes an explicit `signalGenres` array (genres the user has
 * demonstrated affinity for). Callers can derive this however they want:
 *   - From the currently-displayed bookmark's detail (cheapest — one fetch)
 *   - From a one-time backfill that augments BookmarkEntry with genres
 *   - Empty array → genre-overlap signal is simply 0 (function still works)
 *
 * This module is pure TypeScript — no React, no localStorage access.
 */
import type { AnimeCard } from "./anilist";
import type { LocalHiddenTitle, LocalRecentlyViewed } from "./storage/storageTypes";
import type { BookmarkEntry } from "../hooks/useBookmarks";
import type { ListEntry } from "../hooks/useAnimeList";

export interface RecommendationContext {
  bookmarks: BookmarkEntry[];
  animeList: ListEntry[];
  recentlyViewed: LocalRecentlyViewed[];
  hidden: LocalHiddenTitle[];
  /**
   * Genres the user has demonstrated affinity for (e.g., genres of the
   * bookmarked anime currently being used as the recommendation seed).
   * Coarse signal — most Shounen share the same 3 genres.
   */
  signalGenres?: string[];
  /** Trending IDs from AniList — small tie-breaker only. */
  trendingIds?: Set<number>;
  /** Optional mood preference from onboarding (redesign plan §5). */
  moodPreference?: Mood;
  /** Optional duration preference from onboarding. */
  durationPreference?: DurationPref;
}

export type Mood = "action" | "cozy" | "funny" | "romance" | "mystery" | "dark";
export type DurationPref = "short" | "medium" | "long" | "any";

export interface ScoredRecommendation {
  anime: AnimeCard;
  score: number;
  reason: string;
}

// ─── Mood → genre mapping (shared with vibes.ts in a future refactor) ───
const MOOD_GENRES: Record<Mood, string[]> = {
  action: ["Action", "Adventure", "Mecha"],
  cozy: ["Slice of Life", "Fantasy"],
  funny: ["Comedy"],
  romance: ["Romance"],
  mystery: ["Mystery", "Psychological", "Thriller"],
  dark: ["Horror", "Psychological", "Thriller", "Drama"],
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function hiddenSet(hidden: LocalHiddenTitle[]): Set<number> {
  return new Set(hidden.map((h) => h.animeId));
}

function recentlyViewedSet(recent: LocalRecentlyViewed[]): Set<number> {
  return new Set(recent.map((r) => r.animeId));
}

function inProgressSet(list: ListEntry[]): Set<number> {
  return new Set(
    list.filter((e) => e.status === "WATCHING" || e.status === "ON_HOLD").map((e) => e.animeId),
  );
}

function completedSet(list: ListEntry[]): Set<number> {
  return new Set(
    list.filter((e) => e.status === "COMPLETED").map((e) => e.animeId),
  );
}

function matchesMood(genres: string[] | undefined, mood: Mood): boolean {
  const wanted = MOOD_GENRES[mood];
  if (!genres) return false;
  return genres.some((g) => wanted.includes(g));
}

function matchesDuration(episodes: number | null | undefined, pref: DurationPref): boolean {
  if (!episodes) return false;
  switch (pref) {
    case "short": return episodes <= 13;
    case "medium": return episodes > 13 && episodes <= 26;
    case "long": return episodes > 26;
    case "any": return true;
  }
}

function genreOverlap(candidateGenres: string[] | undefined, signal: string[]): number {
  if (!candidateGenres || signal.length === 0) return 0;
  return candidateGenres.filter((g) => signal.includes(g)).length;
}

// ─── Main scoring function ──────────────────────────────────────────────────
export function scoreAnime(
  candidate: AnimeCard,
  ctx: RecommendationContext,
): { score: number; reason: string } {
  // Hard exclusion: hidden titles never appear in recommendations.
  if (hiddenSet(ctx.hidden).has(candidate.id)) {
    return { score: -1000, reason: "Hidden" };
  }

  let score = 0;
  let topReason = "Trending pick";

  // Genre overlap (coarse — see note in file header)
  const overlapCount = genreOverlap(candidate.genres, ctx.signalGenres ?? []);
  if (overlapCount > 0) {
    // +3 per overlapping genre, capped at +9 so it doesn't dominate
    const genreScore = Math.min(overlapCount * 3, 9);
    score += genreScore;
    topReason = `Shares ${overlapCount} genre${overlapCount > 1 ? "s" : ""} with your saved anime`;
  }

  // Trending tie-breaker (small)
  if (ctx.trendingIds?.has(candidate.id)) {
    score += 1;
    if (score === 1) topReason = "Trending right now";
  }

  // Mood preference
  if (ctx.moodPreference && matchesMood(candidate.genres, ctx.moodPreference)) {
    score += 2;
    if (score <= 4) topReason = `Matches your "${ctx.moodPreference}" mood`;
  }

  // Duration preference
  if (ctx.durationPreference && ctx.durationPreference !== "any") {
    if (matchesDuration(candidate.episodes, ctx.durationPreference)) {
      score += 2;
      if (score <= 4) topReason = `Fits your ${ctx.durationPreference} watch time`;
    }
  }

  // Already completed — suppress (don't re-recommend finished shows)
  if (completedSet(ctx.animeList).has(candidate.id)) {
    score -= 6;
    topReason = "Already completed";
  }

  // Recently viewed but not in progress — suppress (avoid re-suggesting
  // dismissed titles)
  const inProgress = inProgressSet(ctx.animeList);
  if (recentlyViewedSet(ctx.recentlyViewed).has(candidate.id) && !inProgress.has(candidate.id)) {
    score -= 4;
  }

  return { score, reason: topReason };
}

// ─── Top-N helper ───────────────────────────────────────────────────────────
export function recommendTopN(
  candidates: AnimeCard[],
  ctx: RecommendationContext,
  n: number,
): ScoredRecommendation[] {
  const scored = candidates
    .map((anime) => {
      const { score, reason } = scoreAnime(anime, ctx);
      return { anime, score, reason };
    })
    .filter((s) => s.score > 0) // drop zero-or-below (hidden, completed-only, etc.)
    .sort((a, b) => b.score - a.score);

  // Dedupe by id (candidates may contain duplicates from multiple sources)
  const seen = new Set<number>();
  const deduped: ScoredRecommendation[] = [];
  for (const s of scored) {
    if (seen.has(s.anime.id)) continue;
    seen.add(s.anime.id);
    deduped.push(s);
    if (deduped.length >= n) break;
  }
  return deduped;
}

// ─── Convenience: score from a seed anime's recommendations ─────────────────
/**
 * Score AniList's recommendation list (already returned by fetchAnimeDetail)
 * against the user's local signals. This is the cheapest path because the
 * candidate list is already fetched — no extra AniList call needed.
 *
 * Caller flow:
 *   1. const detail = await fetchAnimeDetail(bookmarkedAnimeId);
 *   2. const candidates = detail.recommendations.nodes.map(n => n.mediaRecommendation);
 *   3. const recs = recommendFromSeed(candidates, { ...ctx, signalGenres: detail.genres });
 */
export function recommendFromSeed(
  candidates: AnimeCard[],
  ctx: RecommendationContext,
  n = 12,
): ScoredRecommendation[] {
  return recommendTopN(candidates, ctx, n);
}
