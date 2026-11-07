// AnimeX per-episode providers — Zoro / Yuki / Loli / Sora
//
// Modeled directly on animex.one's "Per-Episode Providers" system:
//   1. An AniList ID is mapped to animex.one's internal show slug
//      (worker route /api/anx/resolve — animex.one serves no CORS headers
//      on its page data, so this must go through the worker).
//   2. pp.animex.one/rest/api/servers?id=<slug>&epNum=<n> returns the
//      servers available for THIS episode:
//        { subProviders: [{id, default, tip}], dubProviders: [...] }
//      The list varies per episode (e.g. yuki+loli+sora one week, zoro the
//      next, and a provider can be down per-episode). pp.animex.one DROPPED
//      its open CORS (Nov 2026), so this call goes through the worker's
//      /api/anx/servers proxy.
//   3. pp.animex.one/rest/api/sources?id=<slug>&epNum=<n>&type=<sub|dub>
//      &providerId=<id> returns direct HLS sources + soft-subtitle VTT
//      tracks:
//        { sources: [{url, quality, type}],
//          tracks: [{url, lang, label, kind, default}],
//          headers: {Origin, Referer} }   ← CDNs require these upstream
//      The stream URLs 403 without the megaplay.buzz headers and the m3u8
//      playlists use relative URLs, so playback goes through the worker's
//      /api/anx-stream proxy (Range-aware + m3u8 rewriting — see
//      src/worker/animexRewrite.ts). Sources also go through the worker
//      (/api/anx/sources) for the same CORS reason as the servers list.

/** Chip display names for the per-episode servers (animex.one spelling). */
const PROVIDER_DISPLAY: Record<string, string> = {
  zoro: "Zoro",
  yuki: "Yuki",
  loli: "Loli",
  sora: "Sora",
  nero: "Nero",
};

export function animexProviderDisplayName(id: string): string {
  return PROVIDER_DISPLAY[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

export interface AnimexServerInfo {
  id: string;
  default: boolean;
  tip: string;
}

export interface AnimexServersResponse {
  subProviders: AnimexServerInfo[];
  dubProviders: AnimexServerInfo[];
}

/** A subtitle track attached to an AnimeX source (proxied VTT). */
export interface AnimexTrack {
  url: string; // already wrapped through /api/anx-stream
  label: string;
  lang: string;
  isDefault: boolean;
}

export interface AnimexSource {
  url: string; // already wrapped through /api/anx-stream
  type: "hls";
  quality: string | null;
  sourceName: string; // display name, e.g. "Yuki"
  providerId: string; // raw id, e.g. "yuki"
  tracks: AnimexTrack[];
}

// Slug cache — one resolve call per show per session (the worker also caches,
// this just skips the round-trip entirely on episode switches).
const slugCache = new Map<number, string>();

/**
 * Wrap a stream CDN url through the worker's animex proxy, carrying the
 * per-server upstream headers when the /sources response demands specific
 * ones (nero's megavid.se 403s unless Referer is animex.one; yuki/sora
 * need megaplay.buzz — the proxy's default). The params ride on the URL so
 * every nested playlist/segment request keeps them.
 */
function proxied(
  url: string,
  headers?: { Referer?: string; Origin?: string; "User-Agent"?: string } | null,
): string {
  if (headers && (headers.Referer || headers.Origin || headers["User-Agent"])) {
    const extra = new URLSearchParams();
    if (headers.Referer) extra.set("ref", headers.Referer);
    if (headers.Origin) extra.set("origin", headers.Origin);
    if (headers["User-Agent"]) extra.set("ua", headers["User-Agent"]);
    return `/api/anx-stream?url=${encodeURIComponent(url)}&${extra.toString()}`;
  }
  return `/api/anx-stream?url=${encodeURIComponent(url)}`;
}

/**
 * Resolve animex.one's internal show slug for an AniList ID.
 * Returns null when the show isn't indexed there (worker answers 404).
 */
export async function resolveAnimexShow(
  anilistId: number,
  episode: number,
): Promise<string | null> {
  const cached = slugCache.get(anilistId);
  if (cached) return cached;
  try {
    const res = await fetch(
      `/api/anx/resolve?anilistId=${anilistId}&ep=${episode}`,
      { signal: AbortSignal.timeout(18_000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { slug?: string };
    if (!json.slug) return null;
    slugCache.set(anilistId, json.slug);
    return json.slug;
  } catch (err) {
    console.warn("[animex] slug resolve failed:", err);
    return null;
  }
}

/**
 * Fetch the per-episode server list (drives the provider chips).
 * Returns [] for both tracks of audio on failure — callers treat that as
 * "no per-episode servers this episode".
 */
export async function fetchAnimexServers(
  slug: string,
  episode: number,
): Promise<AnimexServersResponse | null> {
  try {
    const res = await fetch(
      `/api/anx/servers?slug=${encodeURIComponent(slug)}&epNum=${episode}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as AnimexServersResponse | null;
    if (!json || !Array.isArray(json.subProviders)) return null;
    return {
      subProviders: json.subProviders ?? [],
      dubProviders: json.dubProviders ?? [],
    };
  } catch (err) {
    console.warn("[animex] servers fetch failed:", err);
    return null;
  }
}

/**
 * Fetch direct HLS sources for one per-episode provider.
 * Every returned url (video + subtitle tracks) is already wrapped through
 * /api/anx-stream so the player can use it as-is.
 */
export async function fetchAnimexSources(
  slug: string,
  episode: number,
  mode: "sub" | "dub",
  providerId: string,
): Promise<AnimexSource[]> {
  try {
    const res = await fetch(
      `/api/anx/sources?slug=${encodeURIComponent(slug)}&epNum=${episode}` +
        `&type=${mode}&providerId=${encodeURIComponent(providerId)}`,
      { signal: AbortSignal.timeout(18_000) },
    );
    if (!res.ok) {
      console.warn(`[animex] sources for ${providerId} returned ${res.status}`);
      return [];
    }
    const json = (await res.json()) as {
      sources?: Array<{ url?: string; quality?: string; type?: string }>;
      tracks?: Array<{ url?: string; lang?: string; label?: string; kind?: string; default?: boolean }>;
      // The upstream headers pair this server's CDN demands (mirrored by
      // animex.one's own player — some servers also pin an exact User-Agent).
      // Absent → proxy defaults (megaplay.buzz + worker UA).
      headers?: { Referer?: string; Origin?: string; "User-Agent"?: string } | null;
    } | null;
    if (!json?.sources || json.sources.length === 0) return [];

    const display = animexProviderDisplayName(providerId);
    const upstreamHeaders = json.headers ?? null;

    // Soft-subtitle tracks: proxy the VTTs so the browser can read them
    // cross-origin. Prefer real language tracks over thumbnails/forced.
    const tracks: AnimexTrack[] = (json.tracks ?? [])
      .filter((t) => t.url && (t.kind ?? "captions") === "captions")
      .map((t) => ({
        url: proxied(t.url as string, upstreamHeaders),
        label: t.label || t.lang || display,
        lang: (t.lang || "").split(" ")[0] || "en",
        isDefault: !!t.default,
      }));

    return json.sources
      .filter((s) => !!s.url)
      .map((s) => ({
        url: proxied(s.url as string, upstreamHeaders),
        type: "hls" as const,
        quality: s.quality ?? null,
        sourceName: display,
        providerId,
        tracks,
      }));
  } catch (err) {
    console.warn(`[animex] sources fetch failed (${providerId}):`, err);
    return [];
  }
}
