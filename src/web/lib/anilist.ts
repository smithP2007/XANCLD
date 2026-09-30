// AniList GraphQL client — runs in the browser.
//
// AniList's GraphQL API at https://graphql.anilist.co supports CORS,
// so we can call it directly without a server proxy.
// This means zero server cost for metadata requests.

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

// M-21 FIX: the "Hide adult content" toggle was a dead setting — persisted by
// Settings but read NOWHERE, so 18+ titles kept appearing in trending/search/
// browse/schedule. Every card-level fetch now (a) selects the `isAdult` field
// and (b) filters through this helper when the setting is on.
import { getXanSettings } from "../hooks/useSettings";

function filterAdult<T extends { isAdult?: boolean | null }>(media: T[]): T[] {
  try {
    if (getXanSettings().hideAdult) return media.filter((m) => !m.isAdult);
  } catch {
    // settings not initialized — return unfiltered
  }
  return media;
}

// ─── Rate-limit-aware GraphQL fetcher ──────────────────────────
// AniList rate-limits at 90 requests per minute. We DON'T throttle every
// request (that serializes parallel Promise.all calls and causes 7+ second
// load times). Instead, we rely on retry-on-429 with exponential backoff —
// if AniList rate-limits us, we retry after a delay. This keeps parallel
// requests fast while still handling rate-limiting gracefully.

/** Sleep for ms milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Types ─────────────────────────────────────────────────────
export interface AnimeCard {
  id: number;
  title: { romaji: string | null; english: string | null; native: string | null };
  coverImage: { large: string; extraLarge: string; color?: string };
  averageScore: number | null;
  format: string | null;
  episodes: number | null;
  status: string | null;
  seasonYear: number | null;
  season?: string | null;
  bannerImage?: string | null;
  genres?: string[];
  description?: string | null;
  /** AniList media type: "ANIME" | "MANGA" | "NOVEL" | etc. Available on
   *  relations nodes; null/undefined on top-level search/trending results. */
  type?: string | null;
  /** 18+ flag — selected on card-level queries so the "Hide adult content"
   *  setting (M-21) can filter results client-side. */
  isAdult?: boolean | null;
}

export interface AnimeDetail extends AnimeCard {
  description: string | null;
  bannerImage: string | null;
  genres: string[];
  /** AniList tags (e.g. "Shounen", "Ninja", "Iyashikei"). Fetched for the
   *  detail page and used by vibes.ts for more accurate vibe inference. */
  tags: { name: string; rank: number }[];
  duration: number | null;
  studios: { nodes: { name: string; isAnimationStudio: boolean }[] };
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring?: number } | null;
  characters: { nodes: { id: number; name: { full: string }; image: { large: string } }[] };
  relations: { nodes: AnimeCard[] };
  // H-3 FIX: AniList's mediaRecommendation is NULLABLE — recommendation nodes
  // pointing at merged/deleted/adult-flagged titles come back with null.
  // The old non-null type made AnimeDetail dereference `r.mediaRecommendation.id`
  // directly and crash the whole route into the ErrorBoundary.
  recommendations: { nodes: { mediaRecommendation: AnimeCard | null }[] };
}

// ─── GraphQL fetcher with rate-limit handling + retry ──────────
async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff: 1s, 2s, 4s

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(ANILIST_GRAPHQL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
      });

      // Handle rate-limiting (HTTP 429) — retry after backoff
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get("Retry-After") || "0", 10);
        const delay = retryAfter > 0 ? retryAfter * 1000 : RETRY_DELAYS[attempt] ?? 4000;
        console.warn(`[AniList] Rate limited (429), retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
        if (attempt < MAX_RETRIES) {
          await sleep(delay);
          continue;
        }
        console.warn("[AniList] Rate limited — max retries exceeded");
        return null;
      }

      // Handle server errors (5xx) — retry
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        console.warn(`[AniList] Server error ${res.status}, retrying (attempt ${attempt + 1}/${MAX_RETRIES + 1})`);
        await sleep(RETRY_DELAYS[attempt] ?? 4000);
        continue;
      }

      if (!res.ok) {
        console.warn(`[AniList] HTTP ${res.status}`);
        return null;
      }

      const json: Record<string, unknown> = await res.json();
      if (json?.errors) {
        const errMsg = (json.errors as Array<{ message?: string }>)[0]?.message;
        console.warn("[AniList] GraphQL errors:", errMsg);
        // Don't retry on GraphQL errors — they're query syntax issues, not transient
        return null;
      }
      return (json?.data as T) ?? null;
    } catch (err) {
      // Network error — retry with backoff
      if (attempt < MAX_RETRIES) {
        console.warn(`[AniList] Network error, retrying (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, err);
        await sleep(RETRY_DELAYS[attempt] ?? 4000);
        continue;
      }
      console.error("[AniList] fetch failed after retries:", err);
      return null;
    }
  }
  return null;
}

// ─── API ───────────────────────────────────────────────────────
export async function fetchTrending(perPage = 12): Promise<AnimeCard[]> {
  const data = await gql<{ Page: { media: AnimeCard[] } }>(
    `query($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME) {
          id title { romaji english native }
          coverImage { large extraLarge color }
          averageScore format episodes status seasonYear season isAdult
          bannerImage genres
        }
      }
    }`,
    { perPage },
  );
  return filterAdult(data?.Page?.media ?? []);
}

export async function fetchPopular(perPage = 18): Promise<AnimeCard[]> {
  const data = await gql<{ Page: { media: AnimeCard[] } }>(
    `query($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME) {
          id title { romaji english native }
          coverImage { large extraLarge color }
          averageScore format episodes status seasonYear season isAdult
          bannerImage genres
        }
      }
    }`,
    { perPage },
  );
  return filterAdult(data?.Page?.media ?? []);
}

export async function fetchByGenre(genre: string, perPage = 15): Promise<AnimeCard[]> {
  const data = await gql<{ Page: { media: AnimeCard[] } }>(
    `query($genre: String, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(genre: $genre, sort: POPULARITY_DESC, type: ANIME) {
          id title { romaji english native }
          coverImage { large extraLarge color }
          averageScore format episodes status seasonYear season isAdult
          bannerImage genres
        }
      }
    }`,
    { genre, perPage },
  );
  return filterAdult(data?.Page?.media ?? []);
}

export async function searchAnime(
  query: string,
  page = 1,
  perPage = 20,
): Promise<{ media: AnimeCard[]; hasNextPage: boolean }> {
  const data = await gql<{ Page: { media: AnimeCard[]; pageInfo: { hasNextPage: boolean } } }>(
    `query($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage }
        media(search: $search, sort: SEARCH_MATCH, type: ANIME) {
          id title { romaji english native }
          coverImage { large extraLarge color }
          averageScore format episodes status seasonYear season isAdult
          bannerImage genres
        }
      }
    }`,
    { search: query, page, perPage },
  );
  return {
    media: filterAdult(data?.Page?.media ?? []),
    hasNextPage: data?.Page?.pageInfo?.hasNextPage ?? false,
  };
}

/**
 * Fetch a small number of search suggestions for the inline dropdown that
 * appears while the user types in the search bar (redesign plan §4).
 * Uses a smaller page size (default 6) and only fetches the fields needed
 * for a poster + title chip.
 */
export async function fetchSearchSuggestions(
  query: string,
  perPage = 6,
): Promise<AnimeCard[]> {
  if (!query.trim()) return [];
  const data = await gql<{ Page: { media: AnimeCard[] } }>(
    `query($search: String, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(search: $search, sort: SEARCH_MATCH, type: ANIME) {
          id title { romaji english native }
          coverImage { large extraLarge color }
          averageScore format episodes status seasonYear season isAdult
        }
      }
    }`,
    { search: query, perPage },
  );
  return filterAdult(data?.Page?.media ?? []);
}

export interface SearchFilters {
  // Note: AniList's MediaSort enum uses plain START_DATE (ascending) /
  // START_DATE_DESC (descending) — there is no START_DATE_ASC value.
  sort?: "SEARCH_MATCH" | "POPULARITY_DESC" | "SCORE_DESC" | "TRENDING_DESC" | "START_DATE" | "START_DATE_DESC" | "FAVOURITES_DESC" | "TITLE_ROMAJI";
  genres?: string[];
  format?: string | null;
  year?: number | null;
}

export const SORT_OPTIONS: { value: SearchFilters["sort"]; label: string }[] = [
  { value: "SEARCH_MATCH", label: "Relevance" },
  { value: "POPULARITY_DESC", label: "Popularity" },
  { value: "SCORE_DESC", label: "Score" },
  { value: "TRENDING_DESC", label: "Trending" },
  { value: "START_DATE_DESC", label: "Newest" },
  { value: "FAVOURITES_DESC", label: "Favorites" },
];

export const FORMAT_OPTIONS = [
  { value: "TV", label: "TV" },
  { value: "MOVIE", label: "Movie" },
  { value: "OVA", label: "OVA" },
  { value: "ONA", label: "ONA" },
  { value: "SPECIAL", label: "Special" },
  { value: "MUSIC", label: "Music" },
];

export async function searchAnimeAdvanced(
  query: string,
  page: number,
  perPage: number,
  filters: SearchFilters,
): Promise<{ media: AnimeCard[]; hasNextPage: boolean; total: number; currentPage: number }> {
  // Build the query DYNAMICALLY — AniList's GraphQL API returns 0 results when
  // filter variables (genre_in, format, seasonYear) are passed as null.
  // We only include filter arguments when they have actual values.
  const hasGenres = filters.genres && filters.genres.length > 0;
  const hasFormat = !!filters.format;
  const hasYear = !!filters.year;
  const hasSearch = !!query;

  const args: string[] = ["$page: Int", "$perPage: Int", "$sort: [MediaSort]"];
  if (hasSearch) args.push("$search: String");
  if (hasGenres) args.push("$genres: [String]");
  if (hasFormat) args.push("$format: MediaFormat");
  if (hasYear) args.push("$year: Int");

  const mediaArgs: string[] = ["sort: $sort", "type: ANIME"];
  if (hasSearch) mediaArgs.push("search: $search");
  if (hasGenres) mediaArgs.push("genre_in: $genres");
  if (hasFormat) mediaArgs.push("format: $format");
  if (hasYear) mediaArgs.push("seasonYear: $year");

  const gqlQuery = `query(${args.join(", ")}) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage total currentPage }
      media(${mediaArgs.join(", ")}) {
        id title { romaji english native }
        coverImage { large extraLarge color }
        averageScore format episodes status seasonYear season
        bannerImage genres
      }
    }
  }`;

  const variables: Record<string, unknown> = {
    page,
    perPage,
    sort: filters.sort ? [filters.sort] : ["SEARCH_MATCH"],
  };
  if (hasSearch) variables.search = query;
  if (hasGenres) variables.genres = filters.genres;
  if (hasFormat) variables.format = filters.format;
  if (hasYear) variables.year = filters.year;

  const data = await gql<{
    Page: {
      media: AnimeCard[];
      pageInfo: { hasNextPage: boolean; total: number; currentPage: number };
    };
  }>(gqlQuery, variables);

  // M-3 FIX: gql() returns null (never throws) on network failure / 429
  // rate-limiting / GraphQL errors. Returning an empty result here made
  // Browse/Search render a confident "No results" page when AniList was
  // actually unreachable — indistinguishable from a genuinely empty search.
  // Throw so callers can show a retryable error state instead.
  if (!data?.Page) {
    throw new Error(
      "AniList is unreachable or rate-limited right now. Please retry in a minute.",
    );
  }

  return {
    media: filterAdult(data.Page.media ?? []),
    hasNextPage: data.Page.pageInfo?.hasNextPage ?? false,
    total: data.Page.pageInfo?.total ?? 0,
    currentPage: data.Page.pageInfo?.currentPage ?? page,
  };
}

export async function fetchAnimeDetail(id: number): Promise<AnimeDetail | null> {
  const data = await gql<{ Media: AnimeDetail }>(
    `query($id: Int) {
      Media(id: $id, type: ANIME) {
        id title { romaji english native }
        coverImage { large extraLarge color }
        bannerImage
        description
        averageScore format episodes status seasonYear season duration
        genres
        tags { name rank }
        studios { nodes { name isAnimationStudio } }
        nextAiringEpisode { episode airingAt timeUntilAiring }
        characters(sort: ROLE, perPage: 8) {
          nodes {
            id
            name { full }
            image { large }
          }
        }
        relations { nodes { id type title { romaji english native } coverImage { large extraLarge color } averageScore format episodes status seasonYear } }
        recommendations(sort: RATING_DESC, perPage: 6) {
          nodes { mediaRecommendation { id title { romaji english native } coverImage { large extraLarge color } averageScore format episodes status seasonYear } }
        }
      }
    }`,
    { id },
  );
  return data?.Media ?? null;
}

// ─── Character fetcher ─────────────────────────────────────────
// Browser-safe module-level cache (NOT React's cache() which is
// server-only and throws error #321 in client bundles).
// One fetch per character id per page-load — subsequent calls return
// the cached promise/result.
import { CHARACTER_QUERY } from "./anilist-queries";
import {
  CharacterDetailSchema,
  type CharacterDetail,
} from "../types/anime";

const characterCache = new Map<number, Promise<CharacterDetail | null>>();

/** Fetch a character by id, with module-level caching. */
export function fetchCharacter(id: number): Promise<CharacterDetail | null> {
  const cached = characterCache.get(id);
  if (cached) return cached;
  const p = (async () => {
    const data = await gql<{ Character: unknown }>(CHARACTER_QUERY, { id });
    if (!data?.Character) {
      // M-22 FIX: failures were cached FOREVER — the promise resolves to
      // null and every subsequent call (error-state retry, remount) received
      // the cached null until a full page reload. Drop failures from the
      // cache so the next attempt re-fetches.
      characterCache.delete(id);
      return null;
    }
    // Reshape: GraphQL returns { media: { edges: [...] } } but
    // CharacterDetailSchema expects { media: [{ characterRole, media: {...} }] }.
    try {
      const raw = data.Character as Record<string, unknown>;
      const mediaRoot = (raw.media ?? {}) as Record<string, unknown>;
      const edges = Array.isArray(mediaRoot.edges) ? mediaRoot.edges : [];
      const reshaped: Record<string, unknown> = {
        ...raw,
        media: edges.map((e) => {
          const edge = (e ?? {}) as Record<string, unknown>;
          return {
            characterRole: edge.characterRole,
            media: edge.node,
          };
        }),
      };
      return CharacterDetailSchema.parse(reshaped);
    } catch (err) {
      // Schema mismatch (zod parse error, unexpected shape) — also uncached
      // so a transient upstream change can recover on retry.
      console.warn("[AniList] character reshape/parse failed:", err);
      characterCache.delete(id);
      return null;
    }
  })();
  characterCache.set(id, p);
  return p;
}

// ─── Helpers ───────────────────────────────────────────────────
export function getTitle(title: AnimeCard["title"]): string {
  return title.english || title.romaji || title.native || "Untitled";
}

export const GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Mecha", "Mystery", "Psychological", "Romance", "Sci-Fi", "Slice of Life",
  "Sports", "Supernatural", "Thriller",
];

// ─── Trending page (paginated) ─────────────────────────────────
export async function fetchTrendingPage(
  page = 1,
  perPage = 24,
): Promise<{ media: AnimeCard[]; hasNextPage: boolean; total: number }> {
  const data = await gql<{ Page: { media: AnimeCard[]; pageInfo: { hasNextPage: boolean; total: number } } }>(
    `query($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { hasNextPage total }
        media(sort: TRENDING_DESC, type: ANIME) {
          id title { romaji english native }
          coverImage { large extraLarge color }
          averageScore format episodes status seasonYear season isAdult
          bannerImage genres
        }
      }
    }`,
    { page, perPage },
  );
  return {
    media: filterAdult(data?.Page?.media ?? []),
    hasNextPage: data?.Page?.pageInfo?.hasNextPage ?? false,
    total: data?.Page?.pageInfo?.total ?? 0,
  };
}

// ─── Schedule (currently airing) ───────────────────────────────
export interface AiringAnime extends AnimeCard {
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring: number } | null;
}

export async function fetchSchedule(perPage = 50, maxPages = 2): Promise<AiringAnime[]> {
  // Fetch multiple pages of RELEASING anime sorted by POPULARITY_DESC.
  // AniList has ~127 anime with nextAiringEpisode spread across 7 pages.
  //
  // maxPages controls how many pages to fetch:
  //   - Home page uses maxPages=2 (100 anime, ~86 with nextAir) for speed
  //   - Schedule page uses maxPages=7 (350 anime, ~127 with nextAir) for
  //     comprehensive coverage
  //
  // All pages are fetched in PARALLEL via Promise.all for speed.
  const pages = Array.from({ length: maxPages }, (_, i) => i + 1);
  const results = await Promise.all(
    pages.map((page) =>
      gql<{ Page: { media: AiringAnime[]; pageInfo: { hasNextPage: boolean } } }>(
        `query($page: Int, $perPage: Int) {
          Page(page: $page, perPage: $perPage) {
            pageInfo { hasNextPage }
            media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
              id title { romaji english native }
              coverImage { large extraLarge color }
              averageScore format episodes status seasonYear season isAdult
              nextAiringEpisode { episode airingAt timeUntilAiring }
            }
          }
        }`,
        { page, perPage },
      ),
    ),
  );

  const allMedia: AiringAnime[] = [];
  let okPages = 0;
  for (const data of results) {
    if (data?.Page?.media) {
      okPages++;
      allMedia.push(...data.Page.media);
    }
  }

  // gql() returns null per-page on 429 rate-limiting / network errors /
  // GraphQL errors and does NOT throw. If every page failed, returning []
  // would render a confidently wrong "no shows scheduled" page. Surface an
  // error instead so callers can show an error state with a working retry.
  if (okPages === 0) {
    throw new Error(
      "AniList is unreachable or rate-limited right now. Please retry in a minute.",
    );
  }
  if (okPages < results.length) {
    console.warn(
      `[AniList] Schedule: only ${okPages}/${results.length} pages loaded — list may be incomplete`,
    );
  }

  // Filter to only those with a next airing episode, then sort by airing time
  // (M-21: filterAdult also drops 18+ entries when the setting is on)
  return filterAdult(
    allMedia
      .filter((m) => m.nextAiringEpisode)
      .sort((a, b) => (a.nextAiringEpisode!.airingAt - b.nextAiringEpisode!.airingAt)),
  );
}

// ─── Real airing timetable (AniList airingSchedules) ───────────
// AniList maintains an exact airing timetable: one entry per episode with the
// true episode number and true airing timestamp, for past weeks (history) and
// future weeks (as far as episodes are scheduled — typically 2-4+ weeks for
// ongoing shows). This is authoritative data, unlike nextAiringEpisode which
// only exposes each show's NEXT episode and forces clients to guess the rest
// by assuming a weekly cadence (wrong for hiatuses, double episodes, movies).
export interface AiringScheduleEntry {
  id: number;
  episode: number | null;
  airingAt: number; // unix seconds
  media: (AiringAnime & { isAdult?: boolean }) | null;
}

/**
 * Fetch the REAL airing-schedule entries within [startSec, endSec] (unix
 * seconds). Paginates until the window is drained. Throws when the API is
 * unreachable / rate-limited so callers can show an error state instead of
 * silently rendering an empty schedule.
 */
export async function fetchAiringScheduleWindow(
  startSec: number,
  endSec: number,
): Promise<AiringScheduleEntry[]> {
  const out: AiringScheduleEntry[] = [];
  const PER_PAGE = 50;
  const MAX_PAGES = 10; // 10 * 50 = 500 entries — more than any single week holds
  let anySuccess = false;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await gql<{
      Page: {
        pageInfo: { hasNextPage: boolean };
        airingSchedules: AiringScheduleEntry[];
      };
    }>(
      `query($page: Int, $perPage: Int, $start: Int, $end: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo { hasNextPage }
          airingSchedules(airingAt_greater: $start, airingAt_lesser: $end) {
            id
            episode
            airingAt
            media {
              id
              title { romaji english native }
              coverImage { large extraLarge color }
              averageScore format episodes status seasonYear season isAdult
              nextAiringEpisode { episode airingAt timeUntilAiring }
              isAdult
            }
          }
        }
      }`,
      { page, perPage: PER_PAGE, start: startSec, end: endSec },
    );

    if (data?.Page?.airingSchedules) {
      anySuccess = true;
      out.push(...data.Page.airingSchedules);
    }
    if (!data?.Page?.pageInfo?.hasNextPage) break;
  }

  if (!anySuccess) {
    throw new Error(
      "AniList is unreachable or rate-limited right now. Please retry in a minute.",
    );
  }

  return out
    .filter((e) => e.media && !e.media.isAdult)
    .sort((a, b) => a.airingAt - b.airingAt);
}
