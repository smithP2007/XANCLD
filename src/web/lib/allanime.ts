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

  // Retry up to 3 times (AllAnime rate-limits Cloudflare IPs)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/proxy-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://api.allanime.day/api/graphql", body }),
      });
      if (!res.ok) {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
        console.warn(`[AllAnime] search HTTP ${res.status}`);
        return [];
      }
      const json: Record<string, unknown> = await res.json();

      // Check for rate limit
      if (json?.errors) {
        const errMsg = (json.errors as Array<{ message?: string }>)[0]?.message || "";
        if (errMsg.includes("Too many requests") && attempt < 2) {
          console.warn(`[AllAnime] search rate limited, retrying in ${(attempt + 1) * 2}s...`);
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }
      }

      const data = json?.data as { shows?: { edges?: AllAnimeShow[] } } | undefined;
      return data?.shows?.edges ?? [];
    } catch (err) {
      console.error("[AllAnime] search attempt", attempt + 1, "failed:", err);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      return [];
    }
  }
  return [];
}

// ─── AllAnime GraphQL: get episode sources ─────────────────────
export async function getEpisodeSources(
  showId: string,
  episodeStr: string,
  mode: "sub" | "dub" = "sub",
): Promise<SourceUrl[] | null> {
  // As of mid-2026, AllAnime requires a signed aaReq extension (AES-GCM
  // crypto) on every episode query. The browser can't do this directly
  // because it requires fetching __aaCrypto from mkissa.to first, which
  // is CORS-blocked. So we go through the worker's /api/allanime/episode
  // route which implements the full crypto scheme server-side.
  //
  // We try the legacy direct query first (in case AllAnime ever reverts
  // or for older cached responses), then fall back to the crypto route.
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

  // Retry up to 3 times with delays (AllAnime rate-limits Cloudflare IPs)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await proxiedFetch(url);
      const json: Record<string, unknown> = await res.json();

      // Check for rate limit error OR the new AA_CRYPTO_MISSING error
      if (json?.errors) {
        const firstErr = (json.errors as Array<Record<string, unknown>>)[0] ?? {};
        const errMsg = (firstErr.message as string) || "";
        const errCode = (firstErr.extensions as { code?: string })?.code ?? "";

        // Rate limit → retry
        if (errMsg.includes("Too many requests") && attempt < 2) {
          console.warn(`[AllAnime] rate limited, retrying in ${(attempt + 1) * 2}s...`);
          await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
          continue;
        }

        // AA_CRYPTO_MISSING → fall back to the worker's crypto route
        if (errCode === "AA_CRYPTO_MISSING" || errCode.startsWith("AA_CRYPTO")) {
          console.warn(`[AllAnime] ${errCode} — falling back to /api/allanime/episode`);
          return await fetchEpisodeViaCryptoRoute(showId, episodeStr, mode);
        }

        console.warn("[AllAnime] episode query errors:", errMsg, `(${errCode})`);
        // Try crypto route as a last-resort fallback for any other error too
        return await fetchEpisodeViaCryptoRoute(showId, episodeStr, mode);
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
        const sources = decrypted?.episode?.sourceUrls ?? null;
        if (sources && sources.length > 0) return sources;
        // Decryption failed or empty → try crypto route
        return await fetchEpisodeViaCryptoRoute(showId, episodeStr, mode);
      }

      // Empty response → try crypto route
      return await fetchEpisodeViaCryptoRoute(showId, episodeStr, mode);
    } catch (err) {
      console.error("[AllAnime] getEpisodeSources attempt", attempt + 1, "failed:", err);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, (attempt + 1) * 2000));
        continue;
      }
      // Last attempt failed → try crypto route as fallback
      return await fetchEpisodeViaCryptoRoute(showId, episodeStr, mode);
    }
  }
  // All retries exhausted → try crypto route
  return await fetchEpisodeViaCryptoRoute(showId, episodeStr, mode);
}

// ─── Crypto route fallback ─────────────────────────────────────
// Calls the worker's /api/allanime/episode endpoint which implements
// the full mkissa.to AES-GCM crypto scheme server-side.
async function fetchEpisodeViaCryptoRoute(
  showId: string,
  episodeStr: string,
  mode: "sub" | "dub",
): Promise<SourceUrl[] | null> {
  try {
    const params = new URLSearchParams({
      showId,
      episodeString: episodeStr,
      translationType: mode,
    });
    const res = await fetch(`/api/allanime/episode?${params}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.warn(`[AllAnime] crypto route HTTP ${res.status}`);
      return null;
    }
    const json: { sources?: SourceUrl[]; error?: string; cached?: boolean } = await res.json();
    if (json.error && !json.sources) {
      console.warn("[AllAnime] crypto route error:", json.error);
    }
    return json.sources ?? null;
  } catch (err) {
    console.warn("[AllAnime] crypto route failed:", err);
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
// Strategy: filter dead sources, return working iframe/direct URLs.
// Ported from XAN's processAllAnimeSources — filters out:
//   - /apivtwo/clock paths (clock.json endpoint is dead)
//   - ss-hls, sl-mp4 providers (domains are parked/dead)
//   - streamsb.net, streamlare.com domains (dead)
// Remaining sources (ok.ru, mp4upload, etc.) are returned as iframe embeds.
export async function extractSource(
  rawUrl: string,
  sourceName: string,
): Promise<StreamResult[]> {
  const url = decodeUrl(rawUrl);
  const name = (sourceName || "").toLowerCase();

  // ✅ Yt-mp4 → direct MP4 (tools.fast4speed.rsvp)
  if (name.includes("yt-mp4")) {
    if (!url.startsWith("http")) return [];
    return [{ url, type: "mp4", quality: null, sourceName }];
  }

  // ❌ Skip dead clock.json sources (Default, Uv-mp4, Luf-Mp4, Ak, etc.)
  // These decode to /apivtwo/clock?id=... which is a dead endpoint.
  if (url.startsWith("/apivtwo/") || url.startsWith("/apivtwo/clock")) {
    console.log(`[AllAnime] skipping dead clock.json source: ${sourceName}`);
    return [];
  }

  // ❌ Skip non-HTTP URLs (can't be played)
  if (!url.startsWith("http")) {
    return [];
  }

  // ❌ Skip known-dead providers (domains are parked/taken over)
  const DEAD_PROVIDERS = ["ss-hls", "sl-mp4"];
  const DEAD_DOMAINS = ["streamsb.net", "streamlare.com"];
  const isDeadProvider = DEAD_PROVIDERS.some((p) => name.includes(p));
  const isDeadDomain = DEAD_DOMAINS.some((d) => url.includes(d));
  if (isDeadProvider || isDeadDomain) {
    console.log(`[AllAnime] skipping dead provider: ${sourceName} (${url})`);
    return [];
  }

  // ✅ Direct video file URLs (.mp4 or .m3u8) — play directly
  if (url.includes(".mp4") || url.includes(".m3u8")) {
    const isHls = url.includes(".m3u8");
    return [{ url, type: isHls ? "hls" : "mp4", quality: null, sourceName }];
  }

  // ✅ Mp4 (mp4upload) → try scraping for direct .mp4 URL, fall back to iframe
  if (name === "mp4" || url.includes("mp4upload.com")) {
    const scraped = await scrapeEmbedPage(url, sourceName);
    if (scraped.length > 0) {
      return scraped;
    }
    // Fallback: return as iframe — mp4upload's embed page works in iframes
    return [{ url, type: "iframe", quality: null, sourceName }];
  }

  // ✅ All other HTTP URLs → return as iframe embed
  // This covers: ok.ru, filemoon, vizcloud, mycloud, streamwish, etc.
  // These are JS-rendered embed pages designed to be loaded in <iframe> tags.
  // Client-side scraping mostly fails (CORS), so we skip it and go straight to iframe.
  return [{ url, type: "iframe", quality: null, sourceName }];
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

  // Sort by priority (highest first) — XAN uses this order:
  // yt-mp4=1000, default/sak/wixmp/luf-mp4/s-mp4=500, mp4=300, fm-hls/vn-hls=200, viz/mycloud=150
  const sortedUrls = [...sourceUrls].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  // Process all sources in parallel (extractSource filters dead ones)
  const results = await Promise.allSettled(
    sortedUrls.map((entry) => extractSource(entry.sourceUrl, entry.sourceName)),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const entry = sortedUrls[i];
    if (result.status === "fulfilled" && result.value.length > 0) {
      sources.push(...result.value);
    } else if (result.status === "rejected") {
      failures.push({
        source: entry.sourceName,
        reason: result.reason instanceof Error ? result.reason.message : "error",
      });
    }
    // If extractSource returned [], it filtered a dead source — don't add to failures
  }

  // Sort final sources: direct mp4/hls first, then iframe by priority
  sources.sort((a, b) => {
    const aDirect = a.type === "mp4" || a.type === "hls" ? 1 : 0;
    const bDirect = b.type === "mp4" || b.type === "hls" ? 1 : 0;
    if (aDirect !== bDirect) return bDirect - aDirect;
    return 0;
  });

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
