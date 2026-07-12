// AniList GraphQL client — runs in the browser.
//
// AniList's GraphQL API at https://graphql.anilist.co supports CORS,
// so we can call it directly without a server proxy.
// This means zero server cost for metadata requests.

const ANILIST_GRAPHQL = "https://graphql.anilist.co";

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
}

export interface AnimeDetail extends AnimeCard {
  description: string | null;
  bannerImage: string | null;
  genres: string[];
  duration: number | null;
  studios: { nodes: { name: string; isAnimationStudio: boolean }[] };
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring?: number } | null;
  characters: { nodes: { id: number; name: { full: string }; image: { large: string } }[] };
  relations: { nodes: AnimeCard[] };
  recommendations: { nodes: { mediaRecommendation: AnimeCard }[] };
}

// ─── GraphQL fetcher ───────────────────────────────────────────
async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(ANILIST_GRAPHQL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      console.warn(`[AniList] HTTP ${res.status}`);
      return null;
    }
    const json: Record<string, unknown> = await res.json();
    if (json?.errors) {
      console.warn("[AniList] errors:", (json.errors as Array<{ message?: string }>)[0]?.message);
      return null;
    }
    return (json?.data as T) ?? null;
  } catch (err) {
    console.error("[AniList] fetch failed:", err);
    return null;
  }
}

// ─── API ───────────────────────────────────────────────────────
export async function fetchTrending(perPage = 12): Promise<AnimeCard[]> {
  const data = await gql<{ Page: { media: AnimeCard[] } }>(
    `query($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(sort: TRENDING_DESC, type: ANIME) {
          id title { romaji english native }
          coverImage { large extraLarge color }
          averageScore format episodes status seasonYear season
          bannerImage genres
        }
      }
    }`,
    { perPage },
  );
  return data?.Page?.media ?? [];
}

export async function fetchPopular(perPage = 18): Promise<AnimeCard[]> {
  const data = await gql<{ Page: { media: AnimeCard[] } }>(
    `query($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(sort: POPULARITY_DESC, type: ANIME) {
          id title { romaji english native }
          coverImage { large extraLarge color }
          averageScore format episodes status seasonYear season
          bannerImage genres
        }
      }
    }`,
    { perPage },
  );
  return data?.Page?.media ?? [];
}

export async function fetchByGenre(genre: string, perPage = 15): Promise<AnimeCard[]> {
  const data = await gql<{ Page: { media: AnimeCard[] } }>(
    `query($genre: String, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(genre: $genre, sort: POPULARITY_DESC, type: ANIME) {
          id title { romaji english native }
          coverImage { large extraLarge color }
          averageScore format episodes status seasonYear season
          bannerImage genres
        }
      }
    }`,
    { genre, perPage },
  );
  return data?.Page?.media ?? [];
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
          averageScore format episodes status seasonYear season
          bannerImage genres
        }
      }
    }`,
    { search: query, page, perPage },
  );
  return {
    media: data?.Page?.media ?? [],
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
          averageScore format episodes status seasonYear season
        }
      }
    }`,
    { search: query, perPage },
  );
  return data?.Page?.media ?? [];
}

export interface SearchFilters {
  sort?: "SEARCH_MATCH" | "POPULARITY_DESC" | "SCORE_DESC" | "TRENDING_DESC" | "START_DATE_DESC" | "FAVOURITES_DESC";
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
  return {
    media: data?.Page?.media ?? [],
    hasNextPage: data?.Page?.pageInfo?.hasNextPage ?? false,
    total: data?.Page?.pageInfo?.total ?? 0,
    currentPage: data?.Page?.pageInfo?.currentPage ?? page,
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
          averageScore format episodes status seasonYear season
          bannerImage genres
        }
      }
    }`,
    { page, perPage },
  );
  return {
    media: data?.Page?.media ?? [],
    hasNextPage: data?.Page?.pageInfo?.hasNextPage ?? false,
    total: data?.Page?.pageInfo?.total ?? 0,
  };
}

// ─── Schedule (currently airing) ───────────────────────────────
export interface AiringAnime extends AnimeCard {
  nextAiringEpisode: { episode: number; airingAt: number; timeUntilAiring: number } | null;
}

export async function fetchSchedule(perPage = 30): Promise<AiringAnime[]> {
  const now = Math.floor(Date.now() / 1000);
  const data = await gql<{ Page: { media: AiringAnime[] } }>(
    `query($perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, status: RELEASING, sort: TRENDING_DESC) {
          id title { romaji english native }
          coverImage { large extraLarge color }
          averageScore format episodes status seasonYear season
          nextAiringEpisode { episode airingAt timeUntilAiring }
        }
      }
    }`,
    { perPage },
  );
  const media = data?.Page?.media ?? [];
  // Sort by next airing time
  return media
    .filter((m) => m.nextAiringEpisode)
    .sort((a, b) => (a.nextAiringEpisode!.airingAt - b.nextAiringEpisode!.airingAt));
}
