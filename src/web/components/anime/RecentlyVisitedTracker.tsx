// ─── RecentlyVisitedTracker ─────────────────────────────────────
// A tiny client component that renders nothing visible — its only job
// is to record a visit to /anime/:id so the Command Menu can show
// "Recently Visited" entries.
//
// Placed in the AnimeDetail page (the user spec calls it AnimeHero —
// XANCLD has no AnimeHero component, the equivalent is the AnimeDetail
// route's hero section). It auto-fires once after the hook has
// hydrated, so it never fights with other tabs writing concurrently.

import { useEffect } from "react";
import { useRecentlyVisited } from "../../hooks/useRecentlyVisited";
import type { AnimeDetail } from "../../lib/anilist";
import { getTitle } from "../../lib/anilist";

interface Props {
  anime: AnimeDetail;
}

export function RecentlyVisitedTracker({ anime }: Props) {
  const { isLoaded, addVisit } = useRecentlyVisited();

  useEffect(() => {
    if (!isLoaded) return; // wait until localStorage has been hydrated
    if (!anime?.id) return;
    addVisit({
      id: anime.id,
      title: getTitle(anime.title),
      coverImage: anime.coverImage?.large ?? "/placeholder.svg",
      bannerImage: anime.bannerImage ?? null,
    });
    // We intentionally only depend on anime.id + isLoaded — adding
    // addVisit would re-fire every render since addVisit is stable but
    // `anime` is a new object reference on each fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anime?.id, isLoaded]);

  return null;
}
