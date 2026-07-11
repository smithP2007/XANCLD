/**
 * recentSearchesRepository — wraps recent-search storage.
 *
 * Per the redesign plan §5: small dedicated repository for new functionality
 * rather than overloading existing hooks. Stores the last 10 search queries
 * in localStorage under "xan:recent-searches". Pub/sub mirrors the
 * history-sync pattern.
 */
import type { LocalRecentSearch } from "./storageTypes";

const STORAGE_KEY = "xan:recent-searches";
const SYNC_EVENT = "xan-recent-searches-sync";
const MAX_ENTRIES = 10;

function load(): LocalRecentSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LocalRecentSearch[];
  } catch {
    // ignore
  }
  return [];
}

function save(entries: LocalRecentSearch[]): void {
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

export function getRecentSearches(): LocalRecentSearch[] {
  return load();
}

/** Add a query to the recent-searches list. Dedupes + caps at MAX_ENTRIES. */
export function addRecentSearch(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  const existing = load().filter((e) => e.query.toLowerCase() !== trimmed.toLowerCase());
  save([{ query: trimmed, searchedAt: Date.now() }, ...existing].slice(0, MAX_ENTRIES));
}

export function clearRecentSearches(): void {
  save([]);
}

export function removeRecentSearch(query: string): void {
  save(load().filter((e) => e.query !== query));
}
