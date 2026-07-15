// ─── useRecentlyVisited ─────────────────────────────────────────
// Tracks the last 8 anime detail page visits so the Command Menu can
// show "Recently Visited" with one-click jump back.
//
// Design:
// - SSR-safe: localStorage access guarded, initializes with [] on the
//   server and hydrates inside useEffect (so the first client render
//   matches the server render — no hydration mismatch warnings).
// - Cross-tab sync: listens to the `storage` event, so when another
//   tab adds a visit, this tab picks it up.
// - Dedupes by id: revisiting an existing entry promotes it to the top
//   instead of duplicating it.
// - Max 8 items (newest first).

import { useState, useEffect, useCallback } from "react";

export interface RecentlyVisitedEntry {
  id: number;
  title: string;
  coverImage: string;
  bannerImage?: string | null;
  visitedAt: number;
}

const STORAGE_KEY = "xan:recently-visited";
const MAX_ITEMS = 8;

function load(): RecentlyVisitedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as RecentlyVisitedEntry[];
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function save(entries: RecentlyVisitedEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ITEMS)));
  } catch {
    // ignore quota errors
  }
}

export function useRecentlyVisited() {
  const [items, setItems] = useState<RecentlyVisitedEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Hydrate on mount — read from localStorage inside useEffect so SSR
  // renders an empty list and the client matches before hydrating.
  useEffect(() => {
    setItems(load());
    setIsLoaded(true);

    // Cross-tab sync: storage event fires when ANOTHER tab writes.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setItems(load());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addVisit = useCallback(
    (entry: Omit<RecentlyVisitedEntry, "visitedAt">) => {
      setItems((prev) => {
        // Dedupe by id — remove any existing entry with same id, then prepend
        const filtered = prev.filter((x) => x.id !== entry.id);
        const next = [{ ...entry, visitedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
        save(next);
        return next;
      });
    },
    [],
  );

  const clearRecentlyVisited = useCallback(() => {
    save([]);
    setItems([]);
  }, []);

  return { items, isLoaded, addVisit, clearRecentlyVisited };
}
