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

// ─── Environment bindings ──────────────────────────────────────
interface Env {
  ASSETS: Fetcher;
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

// ─── AllAnime constants ────────────────────────────────────────
// As of mid-2026, AllAnime migrated from allmanga.to → mkissa.to.
// The new mkissa.to requires a signed aaReq extension (handled in
// /api/allanime/episode below). The legacy /api/proxy + /api/proxy-post
// routes still use these headers for the search query (which doesn't need
// the new crypto) and for embed-page HTML scraping.
const ALLANIME_API = "https://api.allanime.day/api";
const REFERER = "https://mkissa.to/";
const ORIGIN = "https://mkissa.to";
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
  "allmanga.to", // legacy, may still respond for some endpoints
  // Gogoanime (rotating domains)
  "gogoanime.fi",
  "gogoanime.vc",
  "gogoanime.dk",
  "gogoanime3.co",
  "gogoanime.hu",
  "gogoanime.bid",
  "ajax.gogocdn.net",
  "gogocdn.net",
  "gogoplay.io",
  "streamani.net",
  "gogostream.tv",
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
];

// ─── GET proxy: /api/proxy?url=<encoded-url> ───────────────────
// Forwards the request with AllAnime headers. Used for:
//   - AllAnime GraphQL episode queries
//   - AllAnime clock.json
//   - Embed page HTML scraping (filemoon, vizcloud, mp4upload, etc.)
//
// The browser does all the parsing/decryption. This worker just fetches.
app.get("/api/proxy", async (c) => {
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
        Referer: REFERER,
        Origin: ORIGIN,
        Accept: "application/json, text/html, */*",
      },
    });

    clearTimeout(timeout);

    const body = await res.text();
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
        Referer: REFERER,
        Origin: ORIGIN,
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
    Referer: REFERER,
    Origin: ORIGIN,
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
  const anilistId = c.req.query("anilistId");
  const episode = c.req.query("episode");

  if (!anilistId || !episode) {
    return c.json({ error: "Missing anilistId or episode parameter" }, 400);
  }

  const upstreamUrl = `https://flixcloud.cc/videos/raw?anilist_id=${encodeURIComponent(anilistId)}&episode=${encodeURIComponent(episode)}`;

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

// ─── Health check ──────────────────────────────────────────────
app.get("/api/health", (c) =>
  c.json({ ok: true, ts: Date.now(), worker: "xancld" }),
);

// ─── SPA fallback: serve index.html for all non-API, non-asset routes ──
// This ensures /watch/1, /anime/5, /search?q=foo, etc. all return the
// React SPA instead of 404. The browser's client-side router handles the
// actual route rendering.
app.get("*", (c) => {
  // Try to serve from assets first (for /assets/*, /logo.svg, /placeholder.svg, etc.)
  // The ASSETS binding handles this automatically when not_found_handling is set,
  // but we need to explicitly fall back to index.html for SPA routes.
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
