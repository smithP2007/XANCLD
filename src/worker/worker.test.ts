// ─── XANCLD worker unit tests (bun test) ─────────────────────────────
// Run with: bun test src/worker/worker.test.ts
//
// Coverage:
//  1. /api/health — the worker's liveness route (Hono app under app.request)
//  2-3. Expanding Title Hover settings (Part 2): defaults +
//       expandingTitleHover state transitions through updateSettings()/
//       getXanSettings() — the exact store the Settings → Appearance toggle
//       and the AnimeCard engine read from.
//  4-6. AnimeX per-episode provider plumbing: m3u8 rewriting, SSRF host
//       guard, the devalue slug extractor, and /api/anx-stream route guards.

import { describe, expect, test } from "bun:test";
import app from "./index";
import { getXanSettings, updateSettings } from "../web/hooks/useSettings";
import {
  isBlockedStreamHost,
  parseFirstJsonLine,
  resolveUpstreamHeaders,
  rewriteM3u8,
  wrapStreamUrl,
} from "./animexRewrite";
import { extractAnimexSlug } from "./index";
import { deriveMask, epochCandidates } from "./allanimeCrypto";

// ─── Worker routes ───────────────────────────────────────────────────
describe("XANCLD worker", () => {
  test("GET /api/health responds 200 ok for the xancld worker", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; worker: string; ts: number };
    expect(body.ok).toBe(true);
    expect(body.worker).toBe("xancld");
    expect(typeof body.ts).toBe("number");
  });
});

// ─── Expanding Title Hover settings state machine ────────────────────
// NOTE: under `bun test` there is no window/localStorage, so the settings
// module initializes from DEFAULTS — the tests below intentionally run in
// definition order (defaults first, then the live transitions).
describe("Expanding Title Hover settings (Part 2)", () => {
  test("defaults: expandingTitleHover is ON", () => {
    const s = getXanSettings();
    expect(s.expandingTitleHover).toBe(true);
  });

  test("expandingTitleHover transitions OFF → ON through updateSettings", () => {
    updateSettings({ expandingTitleHover: false });
    expect(getXanSettings().expandingTitleHover).toBe(false);
    updateSettings({ expandingTitleHover: true });
    expect(getXanSettings().expandingTitleHover).toBe(true);
  });
});

// ─── AllAnime mkissa crypto (verified byte-exact vs the live site) ───
describe("AllAnime mkissa crypto", () => {
  test("deriveMask reproduces the build-186 mask", () => {
    // Captured/validated against a live mkissa.to session (x-aa-boot
    // a61841cf… for epoch 2966 / lane k7) — see scripts/aa-boot-search.mjs.
    const mask = deriveMask("186");
    const hex = Array.from(mask)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(hex).toBe(
      "c6d5cef8823b26fdfe3c698fce2fdca1691a35239052897439bf04c9bf3b36e9",
    );
  });

  test("epochCandidates prefers the previous epoch inside the grace window", () => {
    // 1ms before the 2967 boundary → still in epoch 2966's grace window,
    // so the previous epoch is tried first (matches the site's MT walk).
    const now = 1794527999000;
    const eps = epochCandidates(now);
    expect(eps).toEqual([2966, 2967]);
  });

  test("epochCandidates returns only the current epoch past the grace window", () => {
    const now = 1794600000000; // >24h into epoch 2967
    expect(epochCandidates(now)).toEqual([2967]);
  });
});

// ─── AnimeX per-episode providers ────────────────────────────────────
describe("AnimeX m3u8 rewriting", () => {
  test("wraps relative variant playlist + segment lines through /api/anx-stream", () => {
    const src = "https://fetch.nexabloom.top/anime/abc/def/master.m3u8?token=t1";
    const body = [
      "#EXTM3U",
      '#EXT-X-STREAM-INF:BANDWIDTH=5500000,RESOLUTION=1920x1080,NAME="1080p"',
      "index-f1.m3u8",
      '#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=640x360,NAME="480p"',
      "index-f3.m3u8",
    ].join("\n");
    const out = rewriteM3u8(body, src);
    const lines = out.split("\n");
    expect(lines[0]).toBe("#EXTM3U");
    // Tags untouched
    expect(lines[1].startsWith("#EXT-X-STREAM-INF")).toBe(true);
    // Resource lines → proxied absolutes (query is dropped on relative
    // resolution per the URL/HLS spec — same as hls.js; the CDN accepts
    // token-less variant requests, verified upstream)
    const l2 = lines[2];
    expect(l2).toBe(
      wrapStreamUrl("https://fetch.nexabloom.top/anime/abc/def/index-f1.m3u8"),
    );
  });

  test("rewrites URI attributes in EXT-X-KEY / EXT-X-MAP tags", () => {
    const src = "https://cdn.example.com/hls/ep1/index-f2.m3u8";
    const body = [
      "#EXTM3U",
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x1234',
      '#EXT-X-MAP:URI="init.mp4"',
      "seg-001.ts",
    ].join("\n");
    const out = rewriteM3u8(body, src);
    expect(out).toBe(
      [
        "#EXTM3U",
        `#EXT-X-KEY:METHOD=AES-128,URI="${wrapStreamUrl("https://cdn.example.com/hls/ep1/key.bin")}",IV=0x1234`,
        `#EXT-X-MAP:URI="${wrapStreamUrl("https://cdn.example.com/hls/ep1/init.mp4")}"`,
        wrapStreamUrl("https://cdn.example.com/hls/ep1/seg-001.ts"),
      ].join("\n"),
    );
  });

  test("handles absolute + scheme-relative urls and preserves CRLF", () => {
    const src = "https://cdn.example.com/hls/master.m3u8";
    const body = "#EXTM3U\r\nhttps://other.example.com/a.m3u8\r\n//schemeless.example.com/b.m3u8\r\nrel.m3u8\r\n";
    const out = rewriteM3u8(body, src);
    const lines = out.split("\r\n");
    expect(lines.length).toBe(5);
    expect(lines[1]).toBe(wrapStreamUrl("https://other.example.com/a.m3u8"));
    expect(lines[2]).toBe(wrapStreamUrl("https://schemeless.example.com/b.m3u8"));
    expect(lines[3]).toBe(wrapStreamUrl("https://cdn.example.com/hls/rel.m3u8"));
  });
});

// ─── Per-provider upstream headers (nero fix) ───────────────────────
describe("AnimeX per-provider stream headers", () => {
  const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:150.0) Gecko/20100101 Firefox/150.0";

  test("defaults to megaplay.buzz when no ref/origin is given", () => {
    expect(resolveUpstreamHeaders(null, null)).toEqual({
      referer: "https://megaplay.buzz/",
      origin: "https://megaplay.buzz",
      userAgent: DEFAULT_UA,
    });
    expect(resolveUpstreamHeaders(undefined, undefined)).toEqual({
      referer: "https://megaplay.buzz/",
      origin: "https://megaplay.buzz",
      userAgent: DEFAULT_UA,
    });
  });

  test("honors a well-formed https referer (nero / megavid.se case)", () => {
    expect(resolveUpstreamHeaders("https://animex.one", undefined)).toEqual({
      referer: "https://animex.one/",
      origin: "https://animex.one",
      userAgent: DEFAULT_UA,
    });
    // explicit origin wins for Origin, referer still applied
    expect(resolveUpstreamHeaders("https://animex.one", "https://plyr.animex.one")).toEqual({
      referer: "https://animex.one/",
      origin: "https://plyr.animex.one",
      userAgent: DEFAULT_UA,
    });
  });

  test("honors a well-formed User-Agent (sora / mobile Chrome case)", () => {
    const mob = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";
    const out = resolveUpstreamHeaders("https://kaa.lt", null, mob);
    expect(out.userAgent).toBe(mob);
    expect(out.referer).toBe("https://kaa.lt/");
    // garbage UA → default
    expect(resolveUpstreamHeaders(null, null, "short").userAgent).toBe(DEFAULT_UA);
    expect(resolveUpstreamHeaders(null, null, "<script>alert(1)</script>").userAgent).toBe(DEFAULT_UA);
  });

  test("rejects non-https or garbage values (SSRF guard)", () => {
    expect(resolveUpstreamHeaders("http://evil.example", null)).toEqual({
      referer: "https://megaplay.buzz/",
      origin: "https://megaplay.buzz",
      userAgent: DEFAULT_UA,
    });
    expect(resolveUpstreamHeaders("javascript:alert(1)", "ftp://x")).toEqual({
      referer: "https://megaplay.buzz/",
      origin: "https://megaplay.buzz",
      userAgent: DEFAULT_UA,
    });
  });

  test("wrapStreamUrl appends ref/origin params when headers are given", () => {
    const plain = wrapStreamUrl("https://s-91.megavid.se/a/master.txt");
    expect(plain).toBe("/api/anx-stream?url=https%3A%2F%2Fs-91.megavid.se%2Fa%2Fmaster.txt");
    const withHdr = wrapStreamUrl("https://s-91.megavid.se/a/master.txt", {
      ref: "https://animex.one",
      origin: "https://animex.one",
    });
    expect(withHdr).toBe(
      `/api/anx-stream?url=${encodeURIComponent("https://s-91.megavid.se/a/master.txt")}&ref=https%3A%2F%2Fanimex.one&origin=https%3A%2F%2Fanimex.one`,
    );
  });

  test("rewriteM3u8 threads the header params into EVERY rewritten url", () => {
    const src = "https://s-91.megavid.se/i/x/s/deeznuts.txt";
    const body = [
      "#EXTM3U",
      '#EXT-X-STREAM-INF:BANDWIDTH=922484,RESOLUTION=1920x1080',
      "1080p/nut-1.txt",
      '#EXT-X-MAP:URI="init.mp4"',
    ].join("\n");
    const out = rewriteM3u8(body, src, { ref: "https://animex.one", origin: "https://animex.one" });
    const lines = out.split("\n");
    // resource line + URI attribute both carry the params
    expect(lines[2]).toBe(
      wrapStreamUrl("https://s-91.megavid.se/i/x/s/1080p/nut-1.txt", {
        ref: "https://animex.one",
        origin: "https://animex.one",
      }),
    );
    const expectedMap = `#EXT-X-MAP:URI="${wrapStreamUrl("https://s-91.megavid.se/i/x/s/init.mp4", { ref: "https://animex.one", origin: "https://animex.one" })}"`;
    expect(lines[3]).toBe(expectedMap);
    // and without headers nothing is appended (regression guard)
    const plain = rewriteM3u8(body, src);
    expect(plain.split("\n")[2]).toBe(wrapStreamUrl("https://s-91.megavid.se/i/x/s/1080p/nut-1.txt"));
  });
});

describe("AnimeX stream host guard", () => {
  test("blocks localhost, private ranges, link-local and IPv6 literals", () => {
    for (const h of [
      "localhost",
      "sub.localhost",
      "127.0.0.1",
      "10.1.2.3",
      "192.168.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "169.254.169.254",
      "0.0.0.0",
      "metadata.google.internal",
      "::1",
    ]) {
      expect(isBlockedStreamHost(h)).toBe(true);
    }
  });

  test("allows the public stream CDNs", () => {
    for (const h of [
      "fetch.nexabloom.top",
      "ow13u.mysubsplay.com",
      "yaf6t.emeralddrift.world",
      "j1i9s.embermeadow.world",
    ]) {
      expect(isBlockedStreamHost(h)).toBe(false);
    }
  });
});

describe("AnimeX devalue slug extraction", () => {
  test("parses the NDJSON first line (streamed chunks after line 1 are ignored)", () => {
    const raw = [
      JSON.stringify({
        type: "data",
        nodes: [null, { type: "data", data: [{ anime: 1 }, { slug: 2 }, "show-x-abcd"] }],
      }),
      JSON.stringify({ type: "chunk", id: "1", data: 42 }),
    ].join("\n");
    const parsed = parseFirstJsonLine(raw) as { nodes?: unknown[] };
    expect(Array.isArray(parsed.nodes)).toBe(true);
    // …and the slug extractor consumes that first-line payload
    const out = extractAnimexSlug(parsed);
    expect(out.slug).toBe("show-x-abcd");
  });

  test("extracts slug from the indexed page data format", () => {
    const payload = {
      type: "data",
      nodes: [
        null,
        {
          type: "data",
          data: [
            { anime: 1, epNum: 5 }, // root: values are indices
            { anilistId: 3, slug: 4 }, // anime record: slug at index 4
            "178083", // anilistId value (index 2)
            178083, // parsed number (index 3)
            "tokyo-revengers-santen-sensou-hen-nr2on", // slug (index 4)
            1, // epNum value (index 5)
          ],
        },
      ],
    };
    const out = extractAnimexSlug(payload);
    expect(out.slug).toBe("tokyo-revengers-santen-sensou-hen-nr2on");
    expect(out.anilistId).toBe("178083");
    expect(out.epNum).toBe(1);
  });

  test("surfaces the 404 error node", () => {
    const payload = {
      type: "data",
      nodes: [null, { type: "error", error: { message: "Anime not found" }, status: 404 }],
    };
    const out = extractAnimexSlug(payload);
    expect(out.slug).toBe(undefined);
    expect(out.error).toBe("Anime not found");
  });
});

describe("AnimeX worker route guards", () => {
  test("/api/anx/resolve rejects non-numeric anilistId", async () => {
    const res = await app.request("/api/anx/resolve?anilistId=abc&ep=1");
    expect(res.status).toBe(400);
  });

  test("/api/anx-stream rejects missing/non-https/blocked urls", async () => {
    const missing = await app.request("/api/anx-stream");
    expect(missing.status).toBe(400);

    const notHttps = await app.request(
      `/api/anx-stream?url=${encodeURIComponent("http://fetch.nexabloom.top/a.m3u8")}`,
    );
    expect(notHttps.status).toBe(400);

    const blocked = await app.request(
      `/api/anx-stream?url=${encodeURIComponent("https://localhost/secret")}`,
    );
    expect(blocked.status).toBe(403);
  });
});
