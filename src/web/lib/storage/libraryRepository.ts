/**
 * libraryRepository — wraps hidden-titles storage.
 *
 * Per the redesign plan §5: introduce small repository files for new
 * functionality rather than overloading existing hooks. Hidden titles is
 * net-new functionality, so this is purely additive — useBookmarks.ts and
 * useAnimeList.ts are untouched.
 *
 * Storage key: "xan:hidden" (separate from "xan:bookmarks" and "xan:animelist").
 * Pub/sub: uses a CustomEvent ("xan-hidden-sync") fired via queueMicrotask,
 * mirroring the existing history-sync pattern so ContinueWatching, Home,
 * MyLibrary all stay in sync.
 */
import type { LocalHiddenTitle } from "./storageTypes";

const STORAGE_KEY = "xan:hidden";
const SYNC_EVENT = "xan-hidden-sync";

function load(): LocalHiddenTitle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LocalHiddenTitle[];
  } catch {
    // ignore
  }
  return [];
}

function save(entries: LocalHiddenTitle[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
  notify();
}

function notify(): void {
  if (typeof window === "undefined") return;
  queueMicrotask(() => window.dispatchEvent(new CustomEvent(SYNC_EVENT)));
}

export function getHiddenTitles(): LocalHiddenTitle[] {
  return load();
}

export function isHidden(animeId: number): boolean {
  return load().some((e) => e.animeId === animeId);
}

export function hideTitle(entry: Omit<LocalHiddenTitle, "hiddenAt">): void {
  const list = load();
  if (list.some((e) => e.animeId === entry.animeId)) return; // dedupe
  save([{ ...entry, hiddenAt: Date.now() }, ...list]);
}

export function unhideTitle(animeId: number): void {
  save(load().filter((e) => e.animeId !== animeId));
}

export function clearHidden(): void {
  save([]);
}
