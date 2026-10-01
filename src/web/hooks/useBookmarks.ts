import { useState, useEffect, useCallback, useSyncExternalStore } from "react";

export interface BookmarkEntry {
  animeId: number;
  title: string;
  coverImage: string;
  addedAt: number;
}

const STORAGE_KEY = "xan:bookmarks";

function load(): BookmarkEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // L-8 backport: guard against valid-JSON-but-non-array payloads that
      // crashed AnimeCard (bookmarks.some) — same fix the storage
      // repositories already have.
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as BookmarkEntry[]) : [];
    }
  } catch {
    // ignore
  }
  return [];
}

function save(entries: BookmarkEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

// Global state with pub/sub so all components stay in sync
let current: BookmarkEntry[] = [];
const subscribers = new Set<(b: BookmarkEntry[]) => void>();

if (typeof window !== "undefined") {
  current = load();
}

function notify() {
  for (const sub of subscribers) sub(current);
}

// Module-level so useBookmarks() and useToggleBookmark() share ONE
// identity-stable function (safe to pass into memo'd children).
function toggleBookmark(entry: Omit<BookmarkEntry, "addedAt">): void {
  const exists = current.some((b) => b.animeId === entry.animeId);
  if (exists) {
    current = current.filter((b) => b.animeId !== entry.animeId);
  } else {
    current = [{ ...entry, addedAt: Date.now() }, ...current];
  }
  save(current);
  notify();
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>(current);

  useEffect(() => {
    current = load();
    setBookmarks(current);
    const unsub = (b: BookmarkEntry[]) => setBookmarks(b);
    subscribers.add(unsub);
    return () => {
      subscribers.delete(unsub);
    };
  }, []);

  const isBookmarked = useCallback(
    (animeId: number) => bookmarks.some((b) => b.animeId === animeId),
    [bookmarks],
  );

  const removeBookmark = useCallback((animeId: number) => {
    current = current.filter((b) => b.animeId !== animeId);
    save(current);
    notify();
  }, []);

  const clearBookmarks = useCallback(() => {
    current = [];
    save(current);
    notify();
  }, []);

  return {
    bookmarks,
    isBookmarked,
    toggleBookmark,
    removeBookmark,
    clearBookmarks,
  };
}

// ─── B7: per-card selector subscription ────────────────────────────────────
// The old pattern (each AnimeCard calling useBookmarks().isBookmarked(id))
// meant EVERY subscribed card re-rendered on ANY bookmark change — toggling
// one bookmark re-rendered the whole 30-card grid. useSyncExternalStore with
// a boolean selector re-renders a card only when ITS OWN bookmark state
// flips. Pair with React.memo(AnimeCard) for prop-driven re-renders too.

function subscribeBookmarks(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

export function useIsBookmarked(animeId: number): boolean {
  return useSyncExternalStore(
    subscribeBookmarks,
    () => current.some((b) => b.animeId === animeId),
    () => false,
  );
}

/** Stable (identity-never-changes) bookmark toggle for hot-path components. */
export function useToggleBookmark(): (entry: Omit<BookmarkEntry, "addedAt">) => void {
  return toggleBookmark;
}
