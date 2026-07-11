import { useState, useEffect, useCallback } from "react";
import {
  getRecentSearches,
  addRecentSearch,
  clearRecentSearches,
  removeRecentSearch,
} from "../lib/storage/recentSearchesRepository";
import type { LocalRecentSearch } from "../lib/storage/storageTypes";

const SYNC_EVENT = "xan-recent-searches-sync";

/**
 * useRecentSearches — React hook over the recent-searches repository.
 * Mirrors the pub/sub pattern used by useBookmarks/useHiddenTitles.
 */
export function useRecentSearches() {
  const [recent, setRecent] = useState<LocalRecentSearch[]>([]);

  useEffect(() => {
    const read = () => setRecent(getRecentSearches());
    read();
    window.addEventListener(SYNC_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(SYNC_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const add = useCallback((query: string) => {
    addRecentSearch(query);
    setRecent(getRecentSearches());
  }, []);

  const remove = useCallback((query: string) => {
    removeRecentSearch(query);
    setRecent(getRecentSearches());
  }, []);

  const clearAll = useCallback(() => {
    clearRecentSearches();
    setRecent([]);
  }, []);

  return { recent, add, remove, clearAll };
}
