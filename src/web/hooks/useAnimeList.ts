import { useState, useEffect, useCallback } from "react";

export type AnimeStatus = "WATCHING" | "COMPLETED" | "PLANNING" | "ON_HOLD" | "DROPPED";

export const STATUS_LABELS: Record<AnimeStatus, string> = {
  WATCHING: "Watching",
  COMPLETED: "Completed",
  PLANNING: "Plan to Watch",
  ON_HOLD: "On Hold",
  DROPPED: "Dropped",
};

export const STATUS_ORDER: AnimeStatus[] = [
  "WATCHING",
  "COMPLETED",
  "PLANNING",
  "ON_HOLD",
  "DROPPED",
];

export interface ListEntry {
  animeId: number;
  title: string;
  coverImage: string;
  status: AnimeStatus;
  /** Optional user-set progress (episodes watched) */
  progress?: number;
  /** Optional user-set score (1-10) */
  score?: number;
  addedAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "xan:animelist";

function load(): ListEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ListEntry[];
  } catch {
    // ignore
  }
  return [];
}

function save(entries: ListEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

// Global state with pub/sub
let current: ListEntry[] = [];
const subscribers = new Set<(l: ListEntry[]) => void>();

if (typeof window !== "undefined") {
  current = load();
}

function notify() {
  for (const sub of subscribers) sub(current);
}

export function useAnimeList() {
  const [list, setList] = useState<ListEntry[]>(current);

  useEffect(() => {
    // Re-read from localStorage on mount — handles cross-tab updates and
    // ensures we have the latest data after navigation/remounts.
    current = load();
    setList(current);
    const unsub = (l: ListEntry[]) => setList(l);
    subscribers.add(unsub);
    // Also listen for cross-tab localStorage changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        current = load();
        setList(current);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      subscribers.delete(unsub);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // getStatus depends on `list` so it always uses the latest React state,
  // not a stale module-level closure. This was the root cause of the
  // "only one anime gets added" bug — the callback was created once with
  // [] deps and could return stale results after navigation.
  const getStatus = useCallback(
    (animeId: number): AnimeStatus | null => {
      const entry = list.find((e) => e.animeId === animeId);
      return entry?.status ?? null;
    },
    [list],
  );

  const setStatus = useCallback(
    (animeId: number, title: string, coverImage: string, status: AnimeStatus | null) => {
      // Read from module-level `current` (always latest) instead of `list`
      // to avoid stale state issues when multiple components call this
      // in rapid succession.
      const existing = current.find((e) => e.animeId === animeId);
      if (status === null) {
        current = current.filter((e) => e.animeId !== animeId);
      } else if (existing) {
        current = current.map((e) =>
          e.animeId === animeId
            ? { ...e, status, title, coverImage, updatedAt: Date.now() }
            : e,
        );
      } else {
        current = [
          {
            animeId,
            title,
            coverImage,
            status,
            addedAt: Date.now(),
            updatedAt: Date.now(),
          },
          ...current,
        ];
      }
      save(current);
      notify();
    },
    [],
  );

  const updateProgress = useCallback((animeId: number, progress: number) => {
    current = current.map((e) =>
      e.animeId === animeId ? { ...e, progress, updatedAt: Date.now() } : e,
    );
    save(current);
    notify();
  }, []);

  const updateScore = useCallback((animeId: number, score: number) => {
    current = current.map((e) =>
      e.animeId === animeId ? { ...e, score, updatedAt: Date.now() } : e,
    );
    save(current);
    notify();
  }, []);

  const remove = useCallback((animeId: number) => {
    current = current.filter((e) => e.animeId !== animeId);
    save(current);
    notify();
  }, []);

  const clearAll = useCallback(() => {
    current = [];
    save(current);
    notify();
  }, []);

  return {
    list,
    getStatus,
    setStatus,
    updateProgress,
    updateScore,
    remove,
    clearAll,
  };
}
