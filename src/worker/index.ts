// Hono worker for XAN — thin CORS proxy
//
// Architecture: Tier 2 client-side fetch
// - Browser calls AniList GraphQL directly (CORS-enabled)
// - Browser calls this proxy for AllAnime GraphQL + embed pages (CORS-blocked)
// - Browser does AES decryption + HTML parsing + video playback
// - This worker does NO heavy computation — just forwards requests with
//   proper User-Agent/Referer/Origin headers that browsers can't set.
//
// CPU per request: ~2-5ms (well within Workers Free 10ms limit)
// Bundle size: ~50 KB (Hono + this file only)

import { Hono } from "hono";
import { fetchAllAnimeEpisodeDirect } from "./allanimeCrypto";
import { initRuntimeConfig, RT, originAllowed } from "./runtimeConfig";
import {
  isBlockedStreamHost,
  parseFirstJsonLine,
  resolveUpstreamHeaders,
  rewriteM3u8,
  type StreamHeaderParams,
} from "./animexRewrite";

// ─── Environment bindings ──────────────────────────────────────
interface Env {
  // BUG 14 FIX: ASSETS is only present when running under wrangler with the
  // [assets] binding from wrangler.toml. Running the Hono app under a plain
  // Node/Express adapter (see server.ts) or in tests has no such binding —
  // the type is optional and every access is guarded.
  ASSETS?: Fetcher;
  // B8: provider domains come from wrangler.toml [vars] (runtimeConfig.ts
  // applies defaults, so these stay optional).
  ALLANIME_API?: string;
  MKISSA_ORIGIN?: string;
  ZEN_HOST?: string;
  AA_API?: string;
  AA_BOOTSTRAP?: string;
  AA_BUILD_ID?: string;
  AA_LANE?: string;
  // B3/B8: optional opt-in relay protection (comma-separated origins)
  ALLOWED_ORIGINS?: string;
}

const app = new Hono<{ Bindings: Env }>();

// ─── CORS headers for all responses ────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  await next();
  Object.entries(corsHeaders).forEach(([k, v]) => c.header(k, v));
});

// B8: snapshot provider domains from [vars] before any route runs.
app.use("*", async (c, next) => {
  initRuntimeConfig(c.env as unknown as Record<string, unknown>);
  await next();
});

// ─── AllAnime constants ────────────────────────────────────────
// As of mid-2026, AllAnime migrated from allmanga.to → mkissa.to.
// The new mkissa.to requires a signed aaReq extension (handled in
// /api/allanime/episode below). The legacy /api/proxy + /api/proxy-post
// routes still use these headers for the search query (which doesn't need
// the new crypto) and for embed-page HTML scraping.
// B8: the domains moved to runtimeConfig.ts (wrangler.toml [vars]); the
// previously-dead ALLANIME_API copy here was removed — allanimeCrypto.ts
// owns the one real usage.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0";

// ─── Unified proxy allowlist ──────────────────────────────────
// Shared between /api/proxy and /api/stream. Covers AllAnime's CDN
// providers, gogoanime, Koto (megaplay.buzz), Zen (flixcloud.cc),
// and all common embed hosts. Keep expanded — AllAnime rotates CDNs.
const PROXY_ALLOWED_HOSTS = [
  // AllAnime + mkissa.to (new frontend)
  "api.allanime.day",
  "allanime.day",
  "allanime.uns.bio",
  "allanimenews.com",
  "mkissa.to",
  "api.mkissa.net",
  "cdn.mkissa.net",
  "allmanga.to", // legacy, may still respond for some endpoints
  // gogoanime removed
  // Koto + Zen (iframe providers)
  "megaplay.buzz",
  "flixcloud.cc",
  // Isekai2nd (another AllAnime path)
  "isekai2nd.com",
  // Common HLS/MP4/iframe embed hosts
  "tools.fast4speed.rsvp",
  "fast4speed.rsvp",
  "megacloud.tv",
  "vixcloud.co",
  "youtu-chan.com",
  "mp4upload.com",
  "bysekoze.com",
  "vidnest.io",
  "ok.ru",
  "repackager.wixmp.com",
  "wixmp.com",
  "sharepoint.com",
  "filemoon.sx",
  "filemoon.to",
  "vizcloud.co",
  "vizcloud.xyz",
  "mycloud.cc",
  "streamlare.com",
  "kwik.si",
  "kwik.cx",
  "streamta.pe",
  "streamtape.com",
  "streamwish.to",
  "doodstream.com",
  "dood.so",
  "mixdrop.co",
  "mixdrop.to",
  // Pahe / nekostream
  "pahe.nekostream.site",
  "nekostream.site",
  // AnimeX per-episode provider APIs (slug resolution + servers/sources JSON)
  "animex.one",
  "pp.animex.one",
  "plyr.animex.one",
];

// ─── GET proxy: /api/proxy?url=<encoded-url> ───────────────────
// Forwards the request with AllAnime headers. Used for:
//   - AllAnime GraphQL episode queries
//   - AllAnime clock.json
//   - Embed page HTML scraping (filemoon, vizcloud, mp4upload, etc.)
//
// The browser does all the parsing/decryption. This worker just fetches.
app.get("/api/proxy", async (c) => {
  // B3/B8: opt-in relay protection (no-op unless ALLOWED_ORIGINS is set)
  if (!originAllowed(c.env, c.req.header("Origin"))) {
    return c.json({ error: "Origin not allowed" }, 403);
  }

  const url = c.req.query("url");
  if (!url) {
    return c.json({ error: "Missing url parameter" }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return c.json({ error: "Invalid url" }, 400);
  }

  // Allowlist of hosts we'll proxy (prevents open relay)
  // Uses the unified PROXY_ALLOWED_HOSTS defined at module top.
  const allowed = PROXY_ALLOWED_HOSTS.some(
    (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`),
  );
  if (!allowed) {
    return c.json({ error: `Host not allowed: ${parsed.hostname}` }, 403);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Referer: RT().allanimeReferer,
        Origin: RT().allanimeOrigin,
        Accept: "application/json, text/html, */*",
      },
    });

    // B3 FIX: keep the abort timer armed through the BODY read. It used to
    // be cleared right after the headers arrived, leaving `res.text()`
    // unbounded — a slow/large upstream body could hang the request well
    // past the 20s budget. /api/proxy only carries JSON/HTML (video streams
    // have the dedicated Range-aware /api/stream route), so bounding the
    // whole request at 20s is safe.
    const body = await res.text();
    clearTimeout(timeout);

    return new Response(body, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "text/plain",
        ...corsHeaders,
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    return c.json(
      { error: err instanceof Error ? err.message : "Proxy fetch failed" },
      502,
    );
  }
});

// ─── POST proxy: /api/proxy-post ───────────────────────────────
// For AllAnime GraphQL search queries (POST with JSON body)
app.post("/api/proxy-post", async (c) => {
  // B3/B8: opt-in relay protection (no-op unless ALLOWED_ORIGINS is set)
  if (!originAllowed(c.env, c.req.header("Origin"))) {
    return c.json({ error: "Origin not allowed" }, 403);
  }

  const body = await c.req.json().catch(() => null);
  if (!body?.url) {
    return c.json({ error: "Missing url in body" }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(body.url);
  } catch {
    return c.json({ error: "Invalid url" }, 400);
  }

  // Only allow AllAnime API for POST
  if (parsed.hostname !== "api.allanime.day") {
    return c.json({ error: "POST proxy only allows api.allanime.day" }, 403);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(parsed.toString(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        Referer: RT().allanimeReferer,
        Origin: RT().allanimeOrigin,
        Accept: "application/json",
      },
      body: JSON.stringify(body.body ?? {}),
    });

    clearTimeout(timeout);

    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    return c.json(
      { error: err instanceof Error ? err.message : "Proxy fetch failed" },
      502,
    );
  }
});

// ─── Streaming proxy: /api/stream?url=<encoded-url> ────────────
// Streams video content (MP4, HLS segments) through the worker with
// proper headers. Used for MP4 sources that require Referer/Origin
// headers the browser can't set, or that block cross-origin requests.
//
// The response body is streamed (not buffered) so large video files
// don't exhaust worker memory. Supports Range requests for seeking.
app.get("/api/stream", async (c) => {
  // B3/B8: opt-in relay protection (no-op unless ALLOWED_ORIGINS is set)
  if (!originAllowed(c.env, c.req.header("Origin"))) {
    return c.json({ error: "Origin not allowed" }, 403);
  }

  const url = c.req.query("url");
  if (!url) {
    return c.json({ error: "Missing url parameter" }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return c.json({ error: "Invalid url" }, 400);
  }

  // Same allowlist as /api/proxy (unified PROXY_ALLOWED_HOSTS at module top)
  const allowed = PROXY_ALLOWED_HOSTS.some(
    (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`),
  );
  if (!allowed) {
    return c.json({ error: `Host not allowed: ${parsed.hostname}` }, 403);
  }

  // Forward Range header for seeking
  const reqHeaders: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Referer: RT().allanimeReferer,
    Origin: RT().allanimeOrigin,
    Accept: "*/*",
  };
  const range = c.req.header("Range");
  if (range) {
    reqHeaders["Range"] = range;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(parsed.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: reqHeaders,
    });

    clearTimeout(timeout);

    // Stream the response body directly (don't buffer)
    // Forward content-type, content-length, content-range, accept-ranges
    const respHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Range",
      "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
    };

    const forwardHeaders = [
      "content-type", "content-length", "content-range",
      "accept-ranges", "cache-control", "etag",
    ];
    for (const h of forwardHeaders) {
      const val = res.headers.get(h);
      if (val) respHeaders[h] = val;
    }

    return new Response(res.body, {
      status: res.status,
      headers: respHeaders,
    });
  } catch (err) {
    clearTimeout(timeout);
    return c.json(
      { error: err instanceof Error ? err.message : "Stream proxy failed" },
      502,
    );
  }
});

// ─── AllAnime episode resolver (mkissa.to direct crypto) ──────
// GET /api/allanime/episode?showId=...&episodeString=...&translationType=sub|dub
//
// As of mid-2026, AllAnime requires a signed aaReq extension on every
// episode query. This route implements the full mkissa.to crypto scheme
// server-side (fetch __aaCrypto, derive AES key, sign request, decrypt
// tobeparsed) and returns the resolved source URLs.
//
// The browser calls this when the legacy direct query returns AA_CRYPTO_MISSING.
app.get("/api/allanime/episode", async (c) => {
  const showId = c.req.query("showId");
  const episodeString = c.req.query("episodeString");
  const translationType = (c.req.query("translationType") || "sub") as "sub" | "dub";

  if (!showId || !episodeString) {
    return c.json({ error: "Missing showId or episodeString" }, 400);
  }
  if (translationType !== "sub" && translationType !== "dub") {
    return c.json({ error: "translationType must be 'sub' or 'dub'" }, 400);
  }

  const result = await fetchAllAnimeEpisodeDirect(showId, episodeString, translationType);

  return c.json(
    {
      sources: result.sources,
      ...(result.cached ? { cached: true } : {}),
      ...(result.error ? { error: result.error } : {}),
    },
    result.error && !result.sources ? 502 : 200,
  );
});

// ─── Zen (flixcloud.cc) CORS proxy ────────────────────────────
// GET /api/stream-zen?anilistId=...&episode=...
//
// flixcloud.cc is behind Cloudflare and returns 403 to direct browser
// fetches. This route fetches server-side and returns the JSON response
// with CORS headers so the client can read it.
app.get("/api/stream-zen", async (c) => {
  // B3/B8: opt-in relay protection (no-op unless ALLOWED_ORIGINS is set)
  if (!originAllowed(c.env, c.req.header("Origin"))) {
    return c.json({ error: "Origin not allowed" }, 403);
  }

  const anilistId = c.req.query("anilistId");
  const episode = c.req.query("episode");

  if (!anilistId || !episode) {
    return c.json({ error: "Missing anilistId or episode parameter" }, 400);
  }

  const upstreamUrl = `${RT().zenHost}/videos/raw?anilist_id=${encodeURIComponent(anilistId)}&episode=${encodeURIComponent(episode)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return c.json(
        { error: `Upstream returned ${res.status}`, status: "error" },
        502,
      );
    }

    const data = await res.json();
    return c.json(data, 200);
  } catch (err) {
    clearTimeout(timeout);
    return c.json(
      { error: err instanceof Error ? err.message : "Unknown error", status: "error" },
      502,
    );
  }
});

// ─── AnimeX per-episode providers (Zoro / Yuki / Loli / Sora) ───
// Modeled on animex.one: an AniList ID is resolved to that site's internal
// show "slug" via its SvelteKit page data, then pp.animex.one serves the
// per-episode server list and HLS sources. The slug→sources calls have open
// CORS (browser can hit them directly — see src/web/lib/providers/animex.ts);
// the worker only does what the browser CANNOT do:
//   1. /api/anx/resolve — animex.one serves no CORS headers on __data.json
//   2. /api/anx-stream  — stream CDNs 403 without megaplay.buzz headers and
//                          serve m3u8 playlists full of relative URLs

// animex.one slug resolution cache (anilistId → slug). The __data.json
// document is ~100KB; without this cache every episode switch would re-fetch
// it. Slugs are stable per show, so an unbounded Map keyed by anilistId is
// bounded by how many shows a worker instance sees (tiny).
const animexSlugCache = new Map<string, string>();

interface AnimexPageData {
  slug?: string;
  anilistId?: string;
  epNum?: number;
  error?: string;
}

/**
 * Extract the show slug out of animex.one's SvelteKit page data.
 * The payload is devalue's indexed format: a flat array where the root entry
 * is an object whose values are INDICES into the same array (e.g.
 * {anime: 1, epNum: 26, ...} means data[1] is the anime record). We resolve
 * only the two fields we need (root.anime → its .slug / .anilistId) instead
 * of interpreting the whole graph — number-vs-index ambiguity never matters
 * for a plain string lookup.
 */
export function extractAnimexSlug(payload: unknown): AnimexPageData {
  try {
    const root = payload as { nodes?: unknown[] };
    const node = root?.nodes?.[1] as { data?: unknown[]; error?: { message?: string } } | undefined;
    if (!node) return { error: "malformed page data" };
    if (node.error) return { error: node.error.message || "page data error" };
    const arr = node.data;
    if (!Array.isArray(arr)) return { error: "missing data array" };
    const rootIdx = arr[0] as Record<string, number> | undefined;
    if (!rootIdx || typeof rootIdx.anime !== "number") return { error: "missing anime index" };
    const anime = arr[rootIdx.anime] as Record<string, number> | undefined;
    if (!anime || typeof anime.slug !== "number") return { error: "missing slug index" };
    const slug = arr[anime.slug];
    const anilistIdx = typeof anime.anilistId === "number" ? anime.anilistId : -1;
    const anilistId = anilistIdx >= 0 ? String(arr[anilistIdx]) : undefined;
    const epNumIdx = typeof rootIdx.epNum === "number" ? rootIdx.epNum : -1;
    const epNum = epNumIdx >= 0 && typeof arr[epNumIdx] === "number" ? (arr[epNumIdx] as number) : undefined;
    if (typeof slug !== "string" || !slug) return { error: "slug not found" };
    return { slug, anilistId, epNum };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "parse failed" };
  }
}

// GET /api/anx/resolve?anilistId=178083&ep=1
// → { slug: "tokyo-revengers-santen-sensou-hen-nr2on", anilistId, epNum }
app.get("/api/anx/resolve", async (c) => {
  const anilistId = c.req.query("anilistId");
  const ep = c.req.query("ep") || "1";
  if (!anilistId || !/^\d+$/.test(anilistId)) {
    return c.json({ error: "anilistId must be numeric" }, 400);
  }

  const cached = animexSlugCache.get(anilistId);
  if (cached) return c.json({ slug: cached, anilistId, cached: true });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    // The watch route parses the AniList ID out of the URL regardless of the
    // title text, so a constant placeholder title resolves any show.
    const pageUrl = `https://animex.one/watch/x-${anilistId}-episode-${encodeURIComponent(ep)}/__data.json`;
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return c.json({ error: `animex.one returned ${res.status}` }, 502);
    }
    const raw = await res.text();
    const json = parseFirstJsonLine(raw);
    if (!json) return c.json({ error: "empty page data" }, 502);
    const parsed = extractAnimexSlug(json);
    if (parsed.error || !parsed.slug) {
      return c.json({ error: parsed.error || "slug not found" }, 404);
    }
    animexSlugCache.set(anilistId, parsed.slug);
    return c.json({ slug: parsed.slug, anilistId, epNum: parsed.epNum });
  } catch (err) {
    clearTimeout(timeout);
    return c.json(
      { error: err instanceof Error ? err.message : "resolve failed" },
      502,
    );
  }
});

// ─── pp.animex.one REST proxy ────────────────────────────────
// pp.animex.one used to serve open CORS so the browser could call the
// per-episode servers/sources endpoints directly; it now returns NO
// access-control headers, so those calls must run through the worker.
// GET /api/anx/servers?slug=…&epNum=…       → server list for the episode
// GET /api/anx/sources?slug=…&epNum=…&type=sub|dub&providerId=…
//                                           → HLS sources + subtitle tracks
async function proxyAnimexRest(c: any, path: string, params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  const url = `https://pp.animex.one/rest/api/${path}?${qs}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        Origin: "https://animex.one",
        Referer: "https://animex.one/",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return c.json({ error: `pp.animex.one returned ${res.status}` }, 502);
    }
    const data = await res.text();
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    clearTimeout(timeout);
    return c.json(
      { error: err instanceof Error ? err.message : "pp.animex.one fetch failed" },
      502,
    );
  }
}

app.get("/api/anx/servers", (c) => {
  const slug = c.req.query("slug");
  const epNum = c.req.query("epNum");
  if (!slug || !epNum) return c.json({ error: "slug and epNum are required" }, 400);
  return proxyAnimexRest(c, "servers", { id: slug, epNum });
});

app.get("/api/anx/sources", (c) => {
  const slug = c.req.query("slug");
  const epNum = c.req.query("epNum");
  const type = c.req.query("type") || "sub";
  const providerId = c.req.query("providerId");
  if (!slug || !epNum || !providerId) {
    return c.json({ error: "slug, epNum and providerId are required" }, 400);
  }
  if (type !== "sub" && type !== "dub") {
    return c.json({ error: "type must be sub or dub" }, 400);
  }
  return proxyAnimexRest(c, "sources", { id: slug, epNum, type, providerId });
});

// GET /api/anx-stream?url=<encoded stream CDN url>
// Range-aware streaming proxy for the rotating AnimeX stream CDNs.
//   - attaches Origin/Referer the CDNs require (browser cannot set Origin)
//   - rewrites m3u8 playlists so variant playlists, segments, keys and init
//     sections keep flowing through this proxy
//   - everything else (mp4 fragments, vtt subtitles) streams through untouched
app.get("/api/anx-stream", async (c) => {
  if (!originAllowed(c.env, c.req.header("Origin"))) {
    return c.json({ error: "Origin not allowed" }, 403);
  }

  const url = c.req.query("url");
  if (!url) return c.json({ error: "Missing url parameter" }, 400);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return c.json({ error: "Invalid url" }, 400);
  }
  if (parsed.protocol !== "https:") {
    return c.json({ error: "Only https stream urls are allowed" }, 400);
  }
  if (isBlockedStreamHost(parsed.hostname)) {
    return c.json({ error: `Host not allowed: ${parsed.hostname}` }, 403);
  }

  const reqHeaders: Record<string, string> = {
    // animex.one's player passes these on every CDN request — the /sources
    // response echoes the pair each server demands in its `headers` field
    // (yuki/sora → megaplay.buzz, nero/megavid.se → animex.one, sora's
    // segment CDN additionally demands an exact mobile Chrome UA) and the
    // client forwards them here as ref/origin/ua params. Unknown/invalid
    // values fall back to sane defaults (resolveUpstreamHeaders).
    ...resolveUpstreamHeaders(c.req.query("ref"), c.req.query("origin"), c.req.query("ua")),
    Accept: "*/*",
    // CRITICAL: workers fetch does NOT decode Brotli — an upstream
    // `content-encoding: br` response passed through raw, then the serving
    // layer re-labelled it gzip → the browser gunzipped into raw brotli
    // bytes → hls.js "TS packets do not start with 0x47". Request identity
    // encoding so the body we stream is exactly the bytes we got.
    "Accept-Encoding": "identity",
  };
  const range = c.req.header("Range");
  if (range) reqHeaders["Range"] = range;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  // These CDNs burst-rate-limit (429) when a player probes all quality
  // levels at once — retry a couple of times with a short backoff before
  // surfacing the failure to hls.js (which has its own retry ladder).
  let res: Response | null = null;
  try {
    for (let attempt = 0; ; attempt++) {
      res = await fetch(parsed.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: reqHeaders,
      });
      if (
        res &&
        (res.status === 429 || res.status === 503) &&
        attempt < 2 &&
        res.body
      ) {
        const retryAfter = parseFloat(res.headers.get("retry-after") || "");
        const delay =
          Number.isFinite(retryAfter) && retryAfter > 0 && retryAfter <= 2
            ? retryAfter * 1000
            : 300 * (attempt + 1);
        await res.arrayBuffer().catch(() => undefined); // release the socket
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      break;
    }
  } catch (err) {
    clearTimeout(timeout);
    return c.json(
      { error: err instanceof Error ? err.message : "AnimeX stream proxy failed" },
      502,
    );
  }
  const upstream = res as Response;
  clearTimeout(timeout);

  // m3u8 playlists are small text — buffer + rewrite. Everything else must
  // stream through BYTE-EXACT: these CDNs disguise video segments as
  // .jpg/.html/.txt files (seg-f2-00004.txt is real MPEG-TS), so sniffing
  // every text/* response with res.text() corrupted binary segments
  // (532KB TS → 975KB of mojibake → hls.js fragParsingError ~16s in).
  // Detection: playlist content-type OR .m3u8 extension in the path.
  const ctype = (upstream.headers.get("content-type") || "").toLowerCase();
  const isPlaylistType = ctype.includes("mpegurl") || ctype.includes("m3u");
  const pathLooksPlaylist = /\.m3u8($|\?)/i.test(parsed.pathname);

  const respHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length",
  };
  // Never forward hop-by-hop / encoding headers — the body returned here is
  // the exact (already-decoded) byte stream the browser should receive.
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control", "etag"]) {
    const val = upstream.headers.get(h);
    if (val) respHeaders[h] = val;
  }
  // Explicit caching: without it browsers heuristically cache responses —
  // a corrupted entry from an older build (or a dead token URL) then serves
  // forever. Segments are immutable → cacheable; playlists carry rotating
  // token URLs → never cache.
  if (!respHeaders["cache-control"]) {
    respHeaders["cache-control"] = isPlaylistType || pathLooksPlaylist
      ? "no-store"
      : "public, max-age=3600";
  }

  if (!isPlaylistType && !pathLooksPlaylist && upstream.body) {
    // Stream non-playlist bodies through untouched (segments can be huge)
    return new Response(upstream.body, { status: upstream.status, headers: respHeaders });
  }

  const buf = new Uint8Array(await upstream.arrayBuffer());
  // Byte-level sniff — do NOT trust the content-type (some CDNs answer
  // .m3u8 with octet-stream, and a bot-block HTML page must not be
  // mangled by a UTF-8 decode either).
  const head = new TextDecoder("ascii").decode(buf.slice(0, 16)).replace(/^\uFEFF/, "");
  if (!head.startsWith("#EXTM3U")) {
    // Not actually a playlist — re-serve the exact bytes received
    return new Response(buf, { status: upstream.status, headers: respHeaders });
  }
  respHeaders["content-type"] = "application/vnd.apple.mpegurl";
  delete respHeaders["content-length"];
  // Re-attach the provider's ref/origin params so nested variant playlists,
  // keys and segments keep flowing through the proxy with the SAME upstream
  // headers (nero's megavid.se 403s the moment the referer flips back).
  const hdrParams: StreamHeaderParams = {};
  const refParam = c.req.query("ref");
  const originParam = c.req.query("origin");
  const uaParam = c.req.query("ua");
  if (refParam) hdrParams.ref = refParam;
  if (originParam) hdrParams.origin = originParam;
  if (uaParam) hdrParams.ua = uaParam;
  return new Response(
    rewriteM3u8(new TextDecoder("utf-8").decode(buf), parsed.toString(),
      hdrParams.ref || hdrParams.origin || hdrParams.ua ? hdrParams : null),
    {
      status: upstream.status,
      headers: respHeaders,
    },
  );
});

// ─── Health check ─────────────────────────────────────────────────────────
// version tag: bump to verify which build a dev server is actually running
// (stale wrangler processes have bitten this project before).
app.get("/api/health", (c) =>
  c.json({ ok: true, ts: Date.now(), worker: "xancld", ver: "animex-1.2.0" }),
);

// ─── SPA fallback: serve index.html for all non-API, non-asset routes ──
// This ensures /watch/1, /anime/5, /search?q=foo, etc. all return the
// React SPA instead of 404. The browser's client-side router handles the
// actual route rendering.
app.get("*", async (c) => {
  // C-5 FIX: Don't serve SPA HTML for /api/* routes — return proper 404 JSON.
  // Without this, a typo'd API route (e.g. /api/proxi) returns index.html
  // (200 OK with HTML), causing JSON.parse() errors in the client.
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Unknown API route", path: c.req.path }, 404);
  }
  // BUG 14 FIX: c.env.ASSETS is UNDEFINED when the Hono worker runs outside
  // Cloudflare (Node/Express adapter, unit tests, wrangler without the
  // [assets] binding). The unguarded c.env.ASSETS.fetch() threw a TypeError
  // on EVERY page request in those environments. Guard it and fall back to
  // a JSON 404.
  if (c.env?.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.json(
    { error: "Static assets binding (ASSETS) not available in this environment", path: c.req.path },
    404,
  );
});

export default app;
