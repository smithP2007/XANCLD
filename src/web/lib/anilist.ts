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
  coverImage: { large: string; extraLarge: string };
  averageScore: number | null;
  format: string | null;
  episodes: number | null;
  status: string | null;
  seasonYear: number | null;
}

export interface AnimeDetail extends AnimeCard {
  description: string | null;
  bannerImage: string | null;
  genres: string[];
  duration: number | null;
  studios: { nodes: { name: string; isAnimationStudio: boolean }[] };
  nextAiringEpisode: { episode: number; airingAt: number } | null;
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
          coverImage { large extraLarge }
          averageScore format episodes status seasonYear
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
          coverImage { large extraLarge }
          averageScore format episodes status seasonYear
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
          coverImage { large extraLarge }
          averageScore format episodes status seasonYear
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
          coverImage { large extraLarge }
          averageScore format episodes status seasonYear
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

export async function fetchAnimeDetail(id: number): Promise<AnimeDetail | null> {
  const data = await gql<{ Media: AnimeDetail }>(
    `query($id: Int) {
      Media(id: $id, type: ANIME) {
        id title { romaji english native }
        coverImage { large extraLarge }
        bannerImage
        description
        averageScore format episodes status seasonYear duration
        genres
        studios { nodes { name isAnimationStudio } }
        nextAiringEpisode { episode airingAt }
        characters(sort: ROLE, perPage: 8) {
          nodes { id name { full } image { large } }
        }
        relations { nodes { id title { romaji english native } coverImage { large extraLarge } averageScore format episodes status seasonYear } }
        recommendations(sort: RATING_DESC, perPage: 6) {
          nodes { mediaRecommendation { id title { romaji english native } coverImage { large extraLarge } averageScore format episodes status seasonYear } }
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
          coverImage { large extraLarge }
          averageScore format episodes status seasonYear
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
          coverImage { large extraLarge }
          averageScore format episodes status seasonYear
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
