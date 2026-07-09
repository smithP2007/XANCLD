// Zen provider — fetches stream URLs from flixcloud.cc
// Public API (no auth needed) — returns HLS player URL
// We proxy through /api/stream-zen to avoid CORS (flixcloud.cc is behind Cloudflare)
//
// NOTE: flixcloud.cc returns "dual" audio (both sub + dub in one player).
// The player defaults to sub (default_audio_track:0). There is no URL
// parameter to change the default audio track — the user must switch
// audio inside the player's UI (speaker icon → audio track selector).
// We label the source as "Dual Audio" so users know they can switch.

export interface ZenSource {
  url: string;
  type: "iframe";
  quality: string | null;
  sourceName: string;
  provider: "zen";
}

interface FlixcloudResponse {
  status?: string;
  data?: Array<{
    player_url?: string;
    quality?: string;
    audio?: string;
  }>;
  error?: string;
}

/**
 * Fetch stream sources from Zen (flixcloud.cc)
 * @param anilistId - The AniList anime ID
 * @param episode - The episode number
 * @param mode - "sub" or "dub" (flixcloud returns dual-audio; mode is for labeling only)
 * @returns Array of sources (usually 1-2 iframe embeds with dual audio)
 */
export async function fetchZenSources(
  anilistId: number,
  episode: number,
  mode: "sub" | "dub" = "sub",
): Promise<ZenSource[]> {
  try {
    const res = await fetch(
      `/api/stream-zen?anilistId=${anilistId}&episode=${episode}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return [];

    const json: FlixcloudResponse = await res.json();
    if (json.status !== "success" || !json.data) return [];

    const sources: ZenSource[] = [];
    for (const item of json.data) {
      if (item.player_url) {
        const isDual = item.audio === "dual";
        sources.push({
          url: item.player_url,
          type: "iframe",
          quality: isDual ? "Dual Audio" : (item.quality ?? null),
          sourceName: mode === "dub" && isDual ? "Zen (Dual→Dub)" : "Zen",
          provider: "zen",
        });
      }
    }
    return sources;
  } catch (err) {
    console.warn("[zen] fetch failed:", err);
    return [];
  }
}
