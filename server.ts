// ─── OPTIONAL LOCAL NODE/EXPRESS SERVER WRAPPER (Part 4) ─────────────────
//
// Runs XANCLD outside Cloudflare Wrangler: plain Node + Express serving the
// built frontend (dist/) and mounting the Hono worker for every /api/* call
// via @hono/node-server's getRequestListener adapter.
//
//   bun run build          # build the frontend to dist/ first
//   bunx tsx server.ts     # or: bun run dev:local
//   → http://localhost:3000
//
// Requires the optional dev deps (see PART 4 of XANCLD_AI_REPLICATION_GUIDE.txt):
//   express, @hono/node-server, tsx, @types/express
//
// Notes:
//  - The worker's c.env.ASSETS is undefined here (BUG 14 FIX guard) — the
//    SPA fallback below serves index.html instead, and /api/* keeps working
//    through the Hono app (CORS proxy + AllAnime crypto resolver).
//  - Worker env vars are provided via a shim so runtimeConfig.ts picks them
//    up; override any of them with the same-named process env var.

import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { getRequestListener } from "@hono/node-server";
// @ts-expect-error — the worker is a Cloudflare Worker module; Node runs it
// fine at runtime (it only uses Web-standard APIs + fetch).
import worker from "./src/worker/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "dist");
const PORT = Number(process.env.PORT || 3000);

// Minimal Workers-env shim — mirrors wrangler.toml [vars]. Override via env.
const envShim = {
  ALLANIME_API: process.env.ALLANIME_API ?? "https://api.allanime.day/api",
  MKISSA_ORIGIN: process.env.MKISSA_ORIGIN ?? "https://mkissa.to",
  ZEN_HOST: process.env.ZEN_HOST ?? "https://flixcloud.cc",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  // ASSETS intentionally ABSENT — exercises the BUG 14 guard path.
};

// Adapter: Node RequestListener wrapping the Hono app's fetch handler.
// `worker` is the Hono instance itself (export default app), whose .fetch
// matches (request, env, executionContext) — exactly what the adapter feeds.
const apiHandler = getRequestListener(worker.fetch, {
  // @ts-expect-error — the adapter accepts an env override payload.
  env: envShim,
});

const app = express();
app.disable("x-powered-by");

// 1) API first — CORS proxy, AllAnime crypto resolver, Zen proxy, health.
// Express 5 removed the '/api/*' wildcard syntax, so we match on req.path
// inside a prefix-free middleware and restore req.originalUrl before handing
// the request to the Hono adapter (Hono needs the full path to route).
app.use((req, res, next) => {
  if (req.path === "/api" || req.path.startsWith("/api/")) {
    req.url = req.originalUrl;
    return apiHandler(req, res);
  }
  next();
});

// 2) Built frontend assets (hashed /assets/*, logo.svg, placeholder.svg…)
app.use(express.static(DIST_DIR, { index: "index.html", maxAge: "1h" }));

// 3) SPA fallback — client-side router handles /anime/:id, /watch/:id, etc.
// (Express 5: no more app.get('*') — a terminal middleware does the job.)
app.use((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`[XANCLD] Local server ready → http://localhost:${PORT}`);
  console.log(`[XANCLD] Serving ${DIST_DIR} + Hono worker API on /api/*`);
});
