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

// ─── AllAnime constants (must match the client) ────────────────
const ALLANIME_API = "https://api.allanime.day/api";
const REFERER = "https://allmanga.to/";
const ORIGIN = "https://allmanga.to";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0";

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
  const ALLOWED_HOSTS = [
    "api.allanime.day",
    "allanime.day",
    "allmanga.to",
    "tools.fast4speed.rsvp",
    "megacloud.tv",
    "vixcloud.co",
    "youtu-chan.com",
    "mp4upload.com",
    "bysekoze.com",
    "vidnest.io",
    "ok.ru",
    "repackager.wixmp.com",
    "allanimenews.com",
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
    "doodstream.com",
    "dood.so",
    "mixdrop.co",
    "mixdrop.to",
  ];
  const allowed = ALLOWED_HOSTS.some(
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

  // Same allowlist as /api/proxy
  const ALLOWED_HOSTS = [
    "api.allanime.day", "allanime.day", "allmanga.to",
    "tools.fast4speed.rsvp", "megacloud.tv", "vixcloud.co",
    "youtu-chan.com", "mp4upload.com", "bysekoze.com", "vidnest.io",
    "ok.ru", "repackager.wixmp.com", "allanimenews.com",
    "filemoon.sx", "filemoon.to", "vizcloud.co", "vizcloud.xyz",
    "mycloud.cc", "streamlare.com", "kwik.si", "kwik.cx",
    "streamta.pe", "streamtape.com", "doodstream.com", "dood.so",
    "mixdrop.co", "mixdrop.to", "ninjastream.to", "streamwish.to",
    "streamsb.net",
  ];
  const allowed = ALLOWED_HOSTS.some(
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
