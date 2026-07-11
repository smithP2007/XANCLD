import { useState, useEffect, useCallback } from "react";
import {
  getHiddenTitles,
  hideTitle,
  unhideTitle,
  isHidden,
  clearHidden,
} from "../lib/storage/libraryRepository";
import type { LocalHiddenTitle } from "../lib/storage/storageTypes";

const SYNC_EVENT = "xan-hidden-sync";

/**
 * useHiddenTitles — React hook over the hidden-titles repository.
 * Mirrors the pub/sub pattern used by useBookmarks/useAnimeList so every
 * component (AnimeCard, AnimeDetail, MyLibrary) stays in sync.
 */
export function useHiddenTitles() {
  const [hidden, setHidden] = useState<LocalHiddenTitle[]>([]);

  useEffect(() => {
    const read = () => setHidden(getHiddenTitles());
    read();
    window.addEventListener(SYNC_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(SYNC_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  const isHiddenId = useCallback(
    (animeId: number) => hidden.some((h) => h.animeId === animeId),
    [hidden],
  );

  const hide = useCallback((entry: Omit<LocalHiddenTitle, "hiddenAt">) => {
    hideTitle(entry);
    setHidden(getHiddenTitles());
  }, []);

  const unhide = useCallback((animeId: number) => {
    unhideTitle(animeId);
    setHidden(getHiddenTitles());
  }, []);

  const clearAll = useCallback(() => {
    clearHidden();
    setHidden([]);
  }, []);

  return {
    hidden,
    isHiddenId,
    hide,
    unhide,
    clearAll,
  };
}

/** Re-export the bare checker for non-hook contexts (e.g. recommend.ts). */
export { isHidden as isHiddenRaw };
