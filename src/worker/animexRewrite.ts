// AnimeX per-episode provider helpers (worker-side, pure functions)
//
// animex.one (the site this provider family is modeled on) exposes two REST
// endpoints that drive its per-episode servers:
//   GET https://pp.animex.one/rest/api/servers?id=<slug>&epNum=<n>
//   GET https://pp.animex.one/rest/api/sources?id=<slug>&epNum=<n>&type=<sub|dub>&providerId=<yuki|loli|sora|zoro...>
//
// The returned m3u8 playlists use RELATIVE URLs and their CDNs only respond
// to requests carrying megaplay.buzz Origin/Referer headers, so every stream
// byte must flow through /api/anx-stream. That proxy needs to:
//   1. block SSRF-ish hostnames (the stream URLs rotate across many CDNs,
//      so a static allowlist like /api/stream's cannot cover them), and
//   2. rewrite every playlist line into a proxied absolute URL so hls.js
//      keeps requesting through the worker (variant playlists, segments,
//      encryption keys, init sections — all of it).
//
// Kept dependency-free and side-effect-free so bun tests can import directly.

/**
 * Per-provider upstream headers (from the /sources response `headers` field).
 * Different AnimeX servers require different Referer/Origin values:
 *   yuki / sora CDNs → megaplay.buzz (the historical default)
 *   nero (megavid.se) → https://animex.one/  (403s with megaplay.buzz)
 * The values ride on the proxied URL as `ref` / `origin` params so every
 * nested playlist/segment request keeps flowing through the proxy with the
 * RIGHT headers (see /api/anx-stream in src/worker/index.ts).
 */
export interface StreamHeaderParams {
  ref?: string;
  origin?: string;
  ua?: string;
}

const HTTPS_ORIGIN_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+\/?$/i;
const UA_RE = /^[A-Za-z0-9 ._()/;:,[\]-]{16,250}$/;

/**
 * Build the upstream headers for a proxied stream request.
 * Only well-formed https origins are honored — anything else (http:, js:
 * URLs, garbage) falls back to the megaplay.buzz default. A User-Agent is
 * honored only when it looks like a real UA string (sora's CDN demands the
 * exact mobile Chrome UA the /sources response specifies). Exported for tests.
 */
export function resolveUpstreamHeaders(
  ref?: string | null,
  origin?: string | null,
  ua?: string | null,
): { referer: string; origin: string; userAgent: string } {
  const DEFAULT = {
    referer: "https://megaplay.buzz/",
    origin: "https://megaplay.buzz",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0",
  };
  const clean = (v: string | null | undefined) => {
    if (!v) return null;
    const trimmed = v.trim().replace(/\/+$/, "");
    return HTTPS_ORIGIN_RE.test(trimmed) ? trimmed : null;
  };
  const r = clean(ref);
  const o = clean(origin);
  const u = ua && UA_RE.test(ua.trim()) ? ua.trim() : null;
  return {
    referer: r ? `${r}/` : DEFAULT.referer,
    origin: o ?? r ?? DEFAULT.origin,
    userAgent: u ?? DEFAULT.userAgent,
  };
}

/**
 * Query params that must survive re-encoding when wrapping a URL.
 * `hdr` (when present) is appended as ref/origin so the proxy replays the
 * exact upstream headers this provider's CDN demands.
 */
export function wrapStreamUrl(url: string, hdr?: StreamHeaderParams | null): string {
  if (hdr && (hdr.ref || hdr.origin || hdr.ua)) {
    const extra = new URLSearchParams();
    if (hdr.ref) extra.set("ref", hdr.ref);
    if (hdr.origin) extra.set("origin", hdr.origin);
    if (hdr.ua) extra.set("ua", hdr.ua);
    return `/api/anx-stream?url=${encodeURIComponent(url)}&${extra.toString()}`;
  }
  return `/api/anx-stream?url=${encodeURIComponent(url)}`;
}

/**
 * animex.one's SvelteKit endpoints answer with NDJSON: line 1 is the devalue
 * payload, the remaining lines are streamed promise chunks. Returns the first
 * line parsed as JSON, or null when nothing parseable is present.
 */
export function parseFirstJsonLine(raw: string): unknown {
  const firstLine = raw.split("\n", 1)[0]?.trim() ?? "";
  if (!firstLine) return null;
  try {
    return JSON.parse(firstLine);
  } catch {
    return null;
  }
}

/**
 * Hostname guard for the open-ended /api/anx-stream proxy.
 * Stream CDN hostnames rotate constantly (nexabloom.top today, something
 * else next week), so we cannot allowlist them — instead we reject anything
 * that smells like internal infrastructure. All stream URLs seen in the wild
 * are public HTTPS CDNs.
 */
export function isBlockedStreamHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "0.0.0.0" || h === "::1" || h === "[::1]") return true;
  if (h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // IPv4 literal private / link-local ranges
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  // IPv6 literals (any) and cloud metadata endpoints
  if (h.includes(":")) return true;
  if (h === "metadata.google.internal" || h.endsWith(".metadata")) return true;
  return false;
}

/**
 * Rewrite an HLS playlist so every resource request goes through
 * /api/anx-stream.
 *
 * Handles:
 *  - plain URI lines (variant playlists, media segments): `index-f1.m3u8`,
 *    `seg-001.ts`, absolute `https://cdn/...` lines
 *  - quoted URI attributes inside tags: #EXT-X-KEY:...URI="...",
 *    #EXT-X-MAP:...URI="...", #EXT-X-MEDIA:...URI="..." / GROUP resources
 *  - #EXT-X-I-FRAME-STREAM-INF URI attributes
 *
 * Comment lines (#EXTM3U, #EXTINF, #EXT-X-VERSION...) are preserved as-is.
 * Line endings from the upstream are preserved (CRLF vs LF).
 */
export function rewriteM3u8(
  body: string,
  sourceUrl: string,
  hdr?: StreamHeaderParams | null,
): string {
  const base = new URL(sourceUrl);
  const keepEol = body.includes("\r\n");
  const eol = keepEol ? "\r\n" : "\n";
  const lines = body.split(/\r?\n/);

  const absolutize = (raw: string): string => {
    const trimmed = raw.trim();
    if (!trimmed) return raw;
    if (/^(https?:)?\/\//i.test(trimmed)) {
      // scheme-relative → force https through our proxy
      const abs = trimmed.startsWith("//") ? `https:${trimmed}` : trimmed;
      return wrapStreamUrl(abs, hdr);
    }
    try {
      return wrapStreamUrl(new URL(trimmed, base).toString(), hdr);
    } catch {
      return raw; // unparseable — leave untouched, hls.js will error visibly
    }
  };

  // Rewrites URI="..." (and unmatched-quote-safe) occurrences inside a tag line
  const rewriteUriAttributes = (line: string): string =>
    line.replace(/URI="([^"]+)"/g, (_full, uri: string) => `URI="${absolutize(uri)}"`);

  const out = lines.map((line) => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith("#")) {
      // Tag line — only URI="..." attributes need rewriting
      if (t.includes('URI="')) return rewriteUriAttributes(line);
      return line;
    }
    // Plain resource line
    return absolutize(t);
  });

  return out.join(eol);
}
