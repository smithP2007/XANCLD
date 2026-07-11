/**
 * Storage type definitions for XAN's local data.
 *
 * Per the redesign plan §5: a single home for all locally-stored shapes so
 * future migrations to IndexedDB (or schema versions) are a one-file change.
 *
 * NOTE: This file currently only declares types for NEW functionality added
 * by the redesign (hidden titles, recently viewed, recent searches). The
 * existing hooks (useSettings, useBookmarks, useAnimeList) keep their own
 * types for now to avoid a risky migration — see plan critique item #3.
 */

/** A title the user has hidden from discovery surfaces (Home, Trending, etc.). */
export interface LocalHiddenTitle {
  animeId: number;
  title: string;
  coverImage: string;
  hiddenAt: number;
}

/** A detail page the user recently visited. */
export interface LocalRecentlyViewed {
  animeId: number;
  title: string;
  coverImage: string;
  viewedAt: number;
}

/** A search query the user recently submitted. */
export interface LocalRecentSearch {
  query: string;
  searchedAt: number;
}

/**
 * Top-level bundle used for Export/Import Local Data (redesign plan §5).
 * Settings, bookmarks, animelist, and history shapes are declared as `unknown`
 * here because they're owned by their respective hooks; this bundle just
 * aggregates them for serialization. A Zod schema in `LocalDataManager` will
 * validate the imported shape before writing anything back.
 */
export interface LocalDataBundle {
  schemaVersion: 1;
  exportedAt: number;
  settings: unknown;
  bookmarks: unknown;
  animeList: unknown;
  history: unknown;
  hiddenTitles: LocalHiddenTitle[];
  recentlyViewed: LocalRecentlyViewed[];
  recentSearches: LocalRecentSearch[];
}
