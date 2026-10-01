/**
 * Storage type definitions for XAN's local data.
 *
 * Per the redesign plan §5: a single home for all locally-stored shapes so
 * future migrations to IndexedDB (or schema versions) are a one-file change.
 *
 * NOTE: This file currently only declares types for NEW functionality added
 * by the redesign (recently viewed, recent searches). The existing hooks
 * (useSettings, useBookmarks, useAnimeList) keep their own types for now to
 * avoid a risky migration — see plan critique item #3.
 */

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
