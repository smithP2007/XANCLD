import { useState, useEffect, useCallback } from "react";

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
    if (raw) return JSON.parse(raw) as BookmarkEntry[];
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

  const toggleBookmark = useCallback((entry: Omit<BookmarkEntry, "addedAt">) => {
    const exists = current.some((b) => b.animeId === entry.animeId);
    if (exists) {
      current = current.filter((b) => b.animeId !== entry.animeId);
    } else {
      current = [{ ...entry, addedAt: Date.now() }, ...current];
    }
    save(current);
    notify();
  }, []);

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
