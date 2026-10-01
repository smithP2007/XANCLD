// B8: upstream provider domains are CONFIG, not code. AllAnime has already
// rotated domains once (allmanga.to → mkissa.to, api.allanime.day CDN list
// "rotates constantly" per the allowlist comment) and each rotation used to
// require a grep-and-replace across 6 files. Domains now come from
// wrangler.toml [vars] (or the Cloudflare dashboard) with the current values
// as built-in defaults — a rotation is a one-line config change + redeploy.
//
// NOTE: Workers env is per-request, but the provider domains never differ
// between requests of one deployment, so a tiny init-once snapshot (set from
// a global Hono middleware) keeps every module-level helper synchronous.

export interface WorkerRuntimeConfig {
  /** AllAnime GraphQL API root */
  allanimeApi: string;
  /** Referer header sent to AllAnime/mkissa endpoints (with trailing slash) */
  allanimeReferer: string;
  /** Origin header sent to AllAnime/mkissa endpoints */
  allanimeOrigin: string;
  /** mkissa.to watch-page base (the __aaCrypto host) */
  mkissaWatchBase: string;
  /** Zen (FlixCloud) host for /api/stream-zen */
  zenHost: string;
}

const DEFAULTS: WorkerRuntimeConfig = {
  allanimeApi: "https://api.allanime.day/api",
  allanimeReferer: "https://mkissa.to/",
  allanimeOrigin: "https://mkissa.to",
  mkissaWatchBase: "https://mkissa.to",
  zenHost: "https://flixcloud.cc",
};

let cfg: WorkerRuntimeConfig = DEFAULTS;

export function initRuntimeConfig(env: Record<string, unknown> | undefined): void {
  if (!env) {
    cfg = DEFAULTS;
    return;
  }
  cfg = {
    allanimeApi: (env.ALLANIME_API as string) || DEFAULTS.allanimeApi,
    allanimeReferer: (env.MKISSA_ORIGIN as string)
      ? `${env.MKISSA_ORIGIN as string}/`
      : DEFAULTS.allanimeReferer,
    allanimeOrigin: (env.MKISSA_ORIGIN as string) || DEFAULTS.allanimeOrigin,
    mkissaWatchBase: (env.MKISSA_ORIGIN as string) || DEFAULTS.mkissaWatchBase,
    zenHost: (env.ZEN_HOST as string) || DEFAULTS.zenHost,
  };
}

/** Current runtime config (safe to call anywhere after the middleware ran). */
export function RT(): WorkerRuntimeConfig {
  return cfg;
}

// B3/B8: opt-in origin gate for the proxy routes. Set ALLOWED_ORIGINS (comma
// list) in wrangler.toml [vars] to stop other sites/browsers from using your
// deployed worker as a free relay. Requests WITHOUT an Origin header (curl,
// same-origin GETs, server-to-server) always pass — the gate only judges
// cross-origin browser calls. Unset = fully open (previous behavior).
export function originAllowed(env: { ALLOWED_ORIGINS?: string } | undefined, origin: string | undefined): boolean {
  const raw = env?.ALLOWED_ORIGINS;
  if (!raw) return true;
  if (!origin) return true;
  return raw.split(",").map((s) => s.trim()).filter(Boolean).includes(origin);
}
