// Koto provider — embeds megaplay.buzz player
// Public iframe embed (no API call needed — direct iframe URL)
// 0 Worker bandwidth (iframe loads directly from megaplay.buzz)

// B8: env-overridable (baked at build time) with today's value as default
const KOTO_BASE = import.meta.env.VITE_KOTO_BASE ?? "https://megaplay.buzz";

export interface KotoSource {
  url: string;
  type: "iframe";
  quality: string | null;
  sourceName: string;
  provider: "koto";
}

/**
 * Build the Koto (megaplay.buzz) embed URL
 * @param anilistId - The AniList anime ID
 * @param episode - The episode number
 * @param mode - "sub" or "dub"
 * @returns Single iframe embed source
 */
export function getKotoSource(
  anilistId: number,
  episode: number,
  mode: "sub" | "dub" = "sub",
): KotoSource {
  return {
    url: `${KOTO_BASE}/stream/ani/${anilistId}/${episode}/${mode}`,
    type: "iframe",
    quality: null,
    sourceName: "Koto",
    provider: "koto",
  };
}
