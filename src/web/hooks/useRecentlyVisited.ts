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
// Same-tab sync event. The hook is mounted TWICE with independent state —
// RecentlyVisitedTracker (writes on every detail-page visit) and CommandMenu
// (⌘K "Recently Visited", mounted once for the app's lifetime). `storage`
// events do NOT fire for same-tab writes, so the menu used to stay frozen at
// boot-time data until a full reload. Mirrors the xan-history-sync pattern.
const SYNC_EVENT = "xan-recently-visited-sync";

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
    // Same-tab sync (see SYNC_EVENT) — queueMicrotask so callers that save
    // during a React state updater don't trigger the listeners mid-render.
    queueMicrotask(() => window.dispatchEvent(new CustomEvent(SYNC_EVENT)));
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
    const read = () => {
      setItems(load());
      setIsLoaded(true);
    };
    read();

    // Same-tab sync: another mounted instance of this hook (the tracker on
    // the detail page) wrote a visit — refresh even though `storage` never
    // fires for same-tab writes.
    window.addEventListener(SYNC_EVENT, read);
    // Cross-tab sync: storage event fires when ANOTHER tab writes.
    // key === null covers localStorage.clear() (Settings → Clear cached data):
    // without it this tab's next addVisit re-persisted its stale pre-clear
    // list and the wipe silently undid itself.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) read();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, read);
      window.removeEventListener("storage", onStorage);
    };
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
