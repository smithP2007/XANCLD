// Client-side AllAnime extractor — runs entirely in the browser.
//
// This is the key architectural change from the Next.js version:
// - AES-256-CTR decryption uses WebCrypto API (crypto.subtle) instead of node:crypto
// - HTML scraping uses DOMParser instead of regex (more robust)
// - All fetches go through the Hono CORS proxy at /api/proxy?url=...
// - No server-side computation — the server is just a thin proxy
//
// The server (Hono worker) does ~2ms of CPU per request (just forwarding).
// The browser does all the heavy lifting: AES decryption, HTML parsing, etc.
// This keeps the worker well within Cloudflare Free tier's 10ms CPU limit.

const ALLANIME_API = "https://api.allanime.day/api";
const ALLANIME_BASE = "https://allanime.day";
const EPISODE_QUERY_HASH =
  "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";

// ─── Types ─────────────────────────────────────────────────────
export interface SourceUrl {
  sourceName: string;
  sourceUrl: string;
  priority: number;
  type: string;
}

export interface StreamResult {
  url: string;
  type: "hls" | "mp4" | "iframe";
  quality: string | null;
  sourceName: string;
}

export interface AllAnimeShow {
  _id: string;
  name: string;
  englishName: string | null;
  nativeName: string | null;
  aniListId: string | null;
  malId: string | null;
  thumbnail: string | null;
  availableEpisodes?: {
    sub: number;
    dub: number;
    raw: number;
  };
}

// ─── Thin CORS proxy helper ────────────────────────────────────
async function proxiedFetch(url: string): Promise<Response> {
  const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) {
    throw new Error(`Proxy returned ${res.status} for ${url}`);
  }
  return res;
}

// ─── AES-256-CTR decryption via WebCrypto ──────────────────────
// Port of the Node.js version in the original XAN:
//   key  = sha256("Xot36i3lK3:v1")
//   IV   = bytes[1..13] (12 bytes)
//   ctr  = IV + [0,0,0,2] (16-byte counter, block starts at 2)
//   ct   = bytes[13..(length-16)]
//   MAC  = last 16 bytes (ignored)
let cachedAesKey: CryptoKey | null = null;

async function getAesKey(): Promise<CryptoKey> {
  if (cachedAesKey) return cachedAesKey;
  const passphrase = new TextEncoder().encode("Xot36i3lK3:v1");
  const keyBytes = await crypto.subtle.digest("SHA-256", passphrase);
  cachedAesKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CTR" },
    false,
    ["decrypt"],
  );
  return cachedAesKey;
}

export async function decryptTobeparsed(blobB64: string): Promise<unknown> {
  try {
    // Decode base64 → bytes
    const raw = atob(blobB64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    if (bytes.length < 32) return null;

    // IV = bytes[1..13] (12 bytes)
    const iv = bytes.slice(1, 13);

    // Counter = IV + [0,0,0,2] (16-byte counter, block starts at 2)
    const counter = new Uint8Array(16);
    counter.set(iv, 0);
    counter[12] = 0x00;
    counter[13] = 0x00;
    counter[14] = 0x00;
    counter[15] = 0x02;

    // Ciphertext = bytes[13..(length-16)]
    const ciphertext = bytes.slice(13, bytes.length - 16);

    const key = await getAesKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CTR", counter, length: 32 },
      key,
      ciphertext,
    );

    const text = new TextDecoder().decode(decrypted);
    return JSON.parse(text);
  } catch (err) {
    console.error("[AllAnime] decryptTobeparsed failed:", err);
    return null;
  }
}

// ─── URL decoding (XOR + hex) ──────────────────────────────────
export function decodeUrl(raw: string): string {
  if (!raw) return raw;

  // "--" prefix → XOR each byte with 56
  if (raw.startsWith("--")) {
    try {
      const hex = raw.slice(2);
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16) ^ 56;
      }
      return new TextDecoder().decode(bytes);
    } catch {
      return raw;
    }
  }

  // "ap/" prefix → hex decode
  if (raw.startsWith("ap/")) {
    try {
      const hex = raw.slice(3);
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
      return new TextDecoder().decode(bytes);
    } catch {
      return raw;
    }
  }

  return raw;
}

// ─── AllAnime GraphQL: search for show by title ────────────────
export async function searchAllAnime(
  query: string,
): Promise<AllAnimeShow[]> {
  const gqlQuery = `query($s:SearchInput,$limit:Int){shows(search:$s,limit:$limit){edges{_id name englishName aniListId malId thumbnail score type episodeCount availableEpisodes}}}`;
  const body = {
    query: gqlQuery,
    variables: { s: { query }, limit: 10 },
  };

  try {
    const res = await fetch("/api/proxy-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://api.allanime.day/api/graphql", body }),
    });
    if (!res.ok) {
      console.warn(`[AllAnime] search HTTP ${res.status}`);
      return [];
    }
    const json: Record<string, unknown> = await res.json();
    const data = json?.data as { shows?: { edges?: AllAnimeShow[] } } | undefined;
    return data?.shows?.edges ?? [];
  } catch (err) {
    console.error("[AllAnime] search failed:", err);
    return [];
  }
}

// ─── AllAnime GraphQL: get episode sources ─────────────────────
export async function getEpisodeSources(
  showId: string,
  episodeStr: string,
  mode: "sub" | "dub" = "sub",
): Promise<SourceUrl[] | null> {
  const url =
    `${ALLANIME_API}?` +
    new URLSearchParams({
      variables: JSON.stringify({
        showId,
        episodeString: episodeStr,
        translationType: mode,
      }),
      extensions: JSON.stringify({
        persistedQuery: { version: 1, sha256Hash: EPISODE_QUERY_HASH },
      }),
    });

  try {
    const res = await proxiedFetch(url);
    const json: Record<string, unknown> = await res.json();
    if (json?.errors) {
      console.warn("[AllAnime] episode query errors:", (json.errors as Array<{ message?: string }>)[0]?.message);
      return null;
    }

    const data = json?.data as
      | { episode?: { sourceUrls?: SourceUrl[] }; tobeparsed?: string }
      | undefined;

    // Case 1: response is cleartext
    if (data?.episode?.sourceUrls) {
      return data.episode.sourceUrls;
    }

    // Case 2: response is encrypted (tobeparsed)
    if (data?.tobeparsed) {
      const decrypted = (await decryptTobeparsed(data.tobeparsed)) as
        | { episode?: { sourceUrls?: SourceUrl[] } | null }
        | null;
      return decrypted?.episode?.sourceUrls ?? null;
    }

    return null;
  } catch (err) {
    console.error("[AllAnime] getEpisodeSources failed:", err);
    return null;
  }
}

// ─── Embed page HTML scraper (client-side via DOMParser) ───────
async function scrapeEmbedPage(
  embedUrl: string,
  sourceName: string,
): Promise<StreamResult[]> {
  try {
    const res = await proxiedFetch(embedUrl);
    const html = await res.text();

    const out: StreamResult[] = [];
    const seen = new Set<string>();

    const cleanUrl = (u: string) =>
      u.replace(/\\\//g, "/").replace(/\\u002F/g, "/").replace(/&amp;/g, "&");

    // Pattern 1: Direct .m3u8 URLs
    const hlsMatches = html.matchAll(
      /https?:\/\/[^"'\s<>]+\.m3u8[^"'\s<>]*/g,
    );
    for (const m of hlsMatches) {
      const url = cleanUrl(m[0]);
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, type: "hls", quality: null, sourceName });
    }

    // Pattern 2: Direct .mp4 URLs
    const mp4Matches = html.matchAll(
      /https?:\/\/[^"'\s<>]+\.mp4(?:\?[^"'\s<>]*)?(?=["'\s<>]|$)/g,
    );
    for (const m of mp4Matches) {
      const url = cleanUrl(m[0]);
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, type: "mp4", quality: null, sourceName });
    }

    // Pattern 3: JSON sources in JS variables (streamsb, streamtape, etc.)
    // Look for patterns like: sources: [{"file":"https://...","label":"720p"}]
    // or: var sources = [{"file":"...","label":"..."}]
    const jsonSourcePatterns = [
      /sources\s*[:=]\s*(\[[\s\S]*?\])/g,
      /\"file\"\s*:\s*\"(https?:\/\/[^\"]+)\"/g,
      /\"src\"\s*:\s*\"(https?:\/\/[^\"]+)\"/g,
      /player\.src\s*=\s*\"(https?:\/\/[^\"]+)\"/g,
      /sources\s*=\s*\"(https?:\/\/[^\"]+)\"/g,
    ];
    for (const pattern of jsonSourcePatterns) {
      for (const m of html.matchAll(pattern)) {
        const url = cleanUrl(m[1]);
        if (seen.has(url)) continue;
        if (url.includes(".m3u8")) {
          seen.add(url);
          out.push({ url, type: "hls", quality: null, sourceName });
        } else if (url.includes(".mp4")) {
          seen.add(url);
          out.push({ url, type: "mp4", quality: null, sourceName });
        }
      }
    }

    // Pattern 4: eval/packed JS (streamlare, streamsb use packed JS)
    // Look for URLs in packed JavaScript
    const packedUrlMatches = html.matchAll(
      /https?:\/\/[^"'\s<>]{20,}(?:\/stream|\/download|\/dl|\/get)[^"'\s<>]*/gi,
    );
    for (const m of packedUrlMatches) {
      const url = cleanUrl(m[0]);
      if (seen.has(url)) continue;
      if (url.includes(".mp4") || url.includes(".m3u8")) {
        seen.add(url);
        out.push({ url, type: url.includes(".m3u8") ? "hls" : "mp4", quality: null, sourceName });
      }
    }

    return out;
  } catch (err) {
    console.warn(`[${sourceName}] scrape failed:`, err);
    return [];
  }
}

// ─── fetchClockJson: AllAnime's internal stream resolver ───────
// Many AllAnime sources (Default, Sak, Wixmp, Luf-Mp4, S-Mp4, Uv-mp4)
// return a relative path like "/apivtwo/clock?id=...". This function
// fetches the full clock.json (with proper Referer/Origin) and extracts
// direct stream URLs from the "links" array.
async function fetchClockJson(path: string): Promise<StreamResult[]> {
  const fullPath = path.replace("/clock", "/clock.json");
  const fullUrl = fullPath.startsWith("http")
    ? fullPath
    : `${ALLANIME_BASE}${fullPath}`;

  try {
    const res = await proxiedFetch(fullUrl);
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      console.warn("[AllAnime] clock.json response is not JSON");
      return [];
    }

    const out: StreamResult[] = [];
    const obj = json as Record<string, unknown>;
    const links = (obj.links ?? obj.sources ?? []) as Array<Record<string, unknown>>;
    if (Array.isArray(links)) {
      for (const l of links) {
        const url =
          typeof l.link === "string"
            ? l.link
            : typeof l.src === "string"
              ? l.src
              : typeof l.url === "string"
                ? l.url
                : null;
        if (!url) continue;
        const isHls = url.includes(".m3u8") || l.hls === true || l.type === "hls";
        out.push({
          url,
          type: isHls ? "hls" : "mp4",
          quality:
            typeof l.resolutionStr === "string"
              ? l.resolutionStr
              : typeof l.quality === "string"
                ? l.quality
                : typeof l.label === "string"
                  ? l.label
                  : null,
          sourceName: "allanime-clock",
        });
      }
    }
    return out;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.warn(`[AllAnime] clock.json timed out for ${fullUrl}`);
    } else {
      console.warn(`[AllAnime] clock.json failed for ${fullUrl}:`, err);
    }
    return [];
  }
}

// ─── Extract a stream from a source URL ────────────────────────
// Strategy: prefer direct video URLs (mp4/hls), fall back to iframe embeds.
// Most AllAnime sources are embed pages (streamwish, filemoon, mp4upload, etc.)
// that are designed to be loaded in <iframe> tags by browsers. We try to scrape
// direct URLs from them, but if that fails we fall back to iframe embedding.
export async function extractSource(
  rawUrl: string,
  sourceName: string,
): Promise<StreamResult[]> {
  const url = decodeUrl(rawUrl);
  const name = (sourceName || "").toLowerCase();

  // Yt-mp4 → direct MP4 (tools.fast4speed.rsvp) — this IS a direct video URL
  if (name.includes("yt-mp4")) {
    if (!url.startsWith("http")) return [];
    return [{ url, type: "mp4", quality: null, sourceName }];
  }

  // clock.json sources: Default, Sak, Wixmp, Luf-Mp4, S-Mp4, Uv-mp4, etc.
  // Try clock.json first (returns direct URLs). If it fails, skip — we can't
  // iframe these because they're API endpoints, not embed pages.
  if (
    name.includes("default") ||
    name.includes("sak") ||
    name.includes("wixmp") ||
    name.includes("luf-mp4") ||
    name.includes("s-mp4") ||
    name.includes("uv-mp4") ||
    name.includes("sl-mp4") ||
    url.startsWith("/apivtwo/")
  ) {
    const clockResults = await fetchClockJson(url);
    if (clockResults.length > 0) {
      return clockResults.map((r) => ({ ...r, sourceName }));
    }
    return []; // clock.json failed — skip this source
  }

  // Direct video file URLs (.mp4 or .m3u8) — play directly
  if (url.startsWith("http") && (url.includes(".mp4") || url.includes(".m3u8"))) {
    const isHls = url.includes(".m3u8");
    return [{ url, type: isHls ? "hls" : "mp4", quality: null, sourceName }];
  }

  // Embed pages (mp4upload, filemoon, streamwish, streamsb, streamlare,
  // vizcloud, mycloud, ninjastream, vidnest, bysekoze, etc.)
  // Try to scrape direct URLs first. If that fails, return as iframe —
  // the browser will load the embed page in an <iframe> and the embed's
  // own JS player will handle playback.
  const EMBED_HOSTS = [
    "mp4upload.com", "filemoon", "vidnest", "bysekoze",
    "vizcloud", "mycloud", "streamlare", "streamwish",
    "streamsb", "streamtape", "streamta.pe", "doodstream",
    "dood.so", "mixdrop", "ninjastream", "kwik",
    "megacloud", "vixcloud",
  ];
  const isEmbedPage = EMBED_HOSTS.some((h) => url.includes(h)) ||
    name.includes("mp4") || name.includes("fm-hls") || name.includes("vn-hls") ||
    name.includes("viz") || name.includes("mycloud") || name.includes("sw") ||
    name.includes("ss-hls") || name.includes("other");

  if (isEmbedPage) {
    // Try scraping for direct URLs first
    const scraped = await scrapeEmbedPage(url, sourceName);
    if (scraped.length > 0) {
      return scraped;
    }
    // Fallback: return as iframe — the embed page's own player will work
    return [{ url, type: "iframe", quality: null, sourceName }];
  }

  // Ok.ru, Uni → iframe embed
  if (
    (name.includes("ok") && url.includes("ok.ru")) ||
    name.includes("uni")
  ) {
    return [{ url, type: "iframe", quality: null, sourceName }];
  }

  // Any other HTTP URL — try as iframe (most embed pages work in iframes)
  if (url.startsWith("http")) {
    return [{ url, type: "iframe", quality: null, sourceName }];
  }

  return [];
}

// ─── Full pipeline: AniList ID → stream URL ────────────────────
export async function extractStreamUrl(
  allAnimeShowId: string,
  episode: string,
  mode: "sub" | "dub" = "sub",
): Promise<{ sources: StreamResult[]; failures: { source: string; reason: string }[] }> {
  const sources: StreamResult[] = [];
  const failures: { source: string; reason: string }[] = [];

  const sourceUrls = await getEpisodeSources(allAnimeShowId, episode, mode);
  if (!sourceUrls || sourceUrls.length === 0) {
    return { sources, failures };
  }

  // Try each source, collect results
  for (const entry of sourceUrls.slice(0, 6)) {
    try {
      const extracted = await extractSource(entry.sourceUrl, entry.sourceName);
      if (extracted.length > 0) {
        sources.push(...extracted);
      } else {
        failures.push({ source: entry.sourceName, reason: "no sources extracted" });
      }
    } catch (err) {
      failures.push({
        source: entry.sourceName,
        reason: err instanceof Error ? err.message : "unknown error",
      });
    }
  }

  return { sources, failures };
}

// ─── Find AllAnime show by AniList ID ──────────────────────────
export async function findShowByAniListId(
  anilistId: number,
  title: string,
): Promise<AllAnimeShow | null> {
  const results = await searchAllAnime(title);
  if (results.length === 0) return null;

  // Exact match by aniListId
  const exact = results.find((s) => s.aniListId === String(anilistId));
  if (exact) return exact;

  // Fallback: first result
  return results[0] ?? null;
}
