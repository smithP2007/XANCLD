// AllAnime (ANMX) episode resolver — mkissa.net bootstrap-crypto scheme.
//
// As of Nov 2026 AllAnime's frontend (mkissa.to, buildId 186) signs every
// episode query with an `aaReq` proof derived from a weekly-rotating "epoch"
// and a build-embedded mask. The scheme was reverse-engineered from the
// SvelteKit bundle (chunks at cdn.mkissa.net) and verified byte-exact
// against a live browser session:
//
//   1. MASK — 32 bytes assembled from four base64 fragments embedded in the
//      bundle, XORed with a buildId-salt and a (fragIndex*187 + byte*64) term:
//        salt[i]  = (buildId.charCodeAt(i % len) || 0) ^ ((i*234 + 35) & 255)
//        mask[i]  = frag[i] ^ salt[i] ^ ((l*187 + f*64) & 255)
//   2. BOOT TOKEN — hex(HMAC(HMAC(mask, "1fwWJAeMU:<buildId>"),
//      "<buildId>+<host>+<group>+<lane>+<epoch>")) sent as the x-aa-boot
//      header to GET /client-crypto/v1/bootstrap?buildId=…&k=…
//      → { epoch, epochMs, graceMs, switchAt, partB, k }
//   3. AES KEY — key = atob(partB) XOR mask
//   4. aaReq — base64([0x01][iv(12)][AES-GCM(key, iv, payload)])
//        payload = {"v":1,"ts":<5-min bucket>,"epoch":…,"buildId":"186",
//                   "qh":<episode query hash>,"k":"k7"}
//        iv      = SHA256("epoch:buildId:qh:ts:lane").slice(0, 12)
//   5. Episode query — GET https://api.mkissa.net/api
//        ?variables={"showId","translationType","episodeString"}
//        &extensions={"persistedQuery":{"version":1,"sha256Hash":EP_HASH},
//                     "k":"k7","aaReq":…}
//        header: x-build-id: 186
//      → { data: { episode: { sourceUrls } } } or encrypted tobeparsed
//        (AES-GCM with the derived key; legacy sha256("Xot36i3lK3:v1") key
//        still works as fallback).
//
// NOTE: the api.mkissa.net episode endpoint additionally sits behind a
// Cloudflare client gate (NEED_CAPTCHA for flagged clients). When that gate
// blocks a worker deployment, this resolver falls back to the legacy
// unsigned query on api.allanime.day, and the other providers (Koto/Zen/
// AnimeX) still cover playback.
import { RT } from "./runtimeConfig";

// ─── Constants (verified against mkissa.to build 186, lane k7) ───
const VM_FRAGMENTS = [
  "1KCP6HH4CIw=",
  "AKst81/pPjI=",
  "5DdlrLuAeF0=",
  "Kgtk2A3ZOVk=",
];
const BOOT_PREFIX = "1fwWJAeMU:";
const SALT_MUL = 234;
const SALT_ADD = 35;
const FRAG_MUL = 187;
const FRAG_ADD = 64;
const BOOT_GROUP = "mkissa";
const BOOT_HOST = "mkissa.to";
const EPOCH_MS = 604800000; // 7 days — echoed by the bootstrap response
const GRACE_MS = 86400000; // 1 day cross-epoch grace window
const TS_BUCKET_MS = 300000; // aaReq ts is a 5-minute bucket
// Persisted-query hash of the episode sources query (build 186)
const EPISODE_QUERY_HASH =
  "670bbf38d0868f446e2346c1e956ca2c40c416e733ca248fd54e04f1c8b99145";
// Legacy fallback hash + endpoint (unsigned; worked pre-aaReq and still
// serves the shows search)
const LEGACY_EPISODE_HASH =
  "d405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec";
const LEGACY_KEY_STR = "Xot36i3lK3:v1";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export interface SourceUrl {
  sourceName: string;
  sourceUrl: string;
  priority: number;
  type: string;
}

export interface EpisodeResolveResult {
  sources: SourceUrl[] | null;
  cached?: boolean;
  error?: string;
}

// ─── Small helpers ────────────────────────────────────────────
const encoder = new TextEncoder();

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

async function hmacSha256(keyBytes: Uint8Array, msg: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(msg));
  return new Uint8Array(sig);
}

async function sha256Bytes(msg: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(msg)));
}

async function importGcmKey(keyBytes: Uint8Array, usages: KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "AES-GCM" }, false, usages);
}

// ─── Step 1: mask ─────────────────────────────────────────────
export function deriveMask(buildId: string): Uint8Array {
  const salt = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    salt[i] =
      ((buildId.charCodeAt(i % buildId.length) || 0) ^ ((i * SALT_MUL + SALT_ADD) & 255)) & 255;
  }
  const mask = new Uint8Array(32);
  for (let l = 0; l < 4; l++) {
    const frag = b64ToBytes(VM_FRAGMENTS[l]);
    for (let f = 0; f < 8; f++) {
      mask[l * 8 + f] = (frag[f] ^ salt[l * 8 + f] ^ ((l * FRAG_MUL + f * FRAG_ADD) & 255)) & 255;
    }
  }
  return mask;
}

// ─── Step 2: epoch candidates + boot token + bootstrap ────────
// epoch = floor(now / 7d); during the first 24h of a new epoch the previous
// one is still accepted (grace), so both candidates are tried in order.
export function epochCandidates(now = Date.now()): number[] {
  const cur = Math.floor(now / EPOCH_MS);
  const prev = now - cur * EPOCH_MS < GRACE_MS && cur > 0 ? cur - 1 : cur;
  return [...new Set([prev, cur])];
}

function lane(): string {
  return RT().aaLane || "k7";
}

function buildId(): string {
  return RT().aaBuildId || "186";
}

async function bootToken(mask: Uint8Array, epoch: number): Promise<string> {
  const inner = await hmacSha256(mask, BOOT_PREFIX + buildId());
  const msg = [buildId(), BOOT_HOST, BOOT_GROUP, lane(), String(epoch)].join("+");
  return bytesToHex(await hmacSha256(inner, msg));
}

interface BootstrapState {
  epoch: number;
  partB: string;
  k: string;
}

let bootCache: { state: BootstrapState; keyBytes: Uint8Array; expiresAt: number } | null = null;
const BOOT_TTL_MS = 4 * 60 * 1000; // bootstrap itself caches 5 min server-side

async function fetchBootstrapFor(mask: Uint8Array, epoch: number): Promise<BootstrapState | null> {
  const boot = await bootToken(mask, epoch);
  const base = RT().aaBootstrap || "https://api.mkissa.net/client-crypto/v1/bootstrap";
  const url = `${base}?buildId=${encodeURIComponent(buildId())}&k=${encodeURIComponent(lane())}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": UA,
        Referer: `https://${BOOT_HOST}/`,
        Origin: `https://${BOOT_HOST}`,
        "x-build-id": buildId(),
        "x-aa-boot": boot,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<BootstrapState> | null;
    if (!json?.partB || typeof json.epoch !== "number") return null;
    return { epoch: json.epoch, partB: json.partB, k: json.k || lane() };
  } catch {
    return null;
  }
}

async function getBootState(mask: Uint8Array): Promise<{ state: BootstrapState; keyBytes: Uint8Array } | null> {
  if (bootCache && bootCache.expiresAt > Date.now()) {
    return { state: bootCache.state, keyBytes: bootCache.keyBytes };
  }
  for (const epoch of epochCandidates()) {
    const state = await fetchBootstrapFor(mask, epoch);
    if (!state) continue;
    const partB = b64ToBytes(state.partB);
    const keyBytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) keyBytes[i] = partB[i] ^ mask[i % mask.length];
    bootCache = { state, keyBytes, expiresAt: Date.now() + BOOT_TTL_MS };
    return { state, keyBytes };
  }
  return null;
}

// ─── Step 4: aaReq signing ────────────────────────────────────
async function buildAaReq(
  keyBytes: Uint8Array,
  epoch: number,
  queryHash: string,
  ts: number,
): Promise<string> {
  const payload = JSON.stringify({
    v: 1,
    ts,
    epoch,
    buildId: buildId(),
    qh: queryHash,
    k: lane(),
  });
  const ivSource = `${epoch}:${buildId()}:${queryHash}:${ts}:${lane()}`;
  const iv = (await sha256Bytes(ivSource)).slice(0, 12);
  const aesKey = await importGcmKey(keyBytes, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoder.encode(payload)));
  const out = new Uint8Array(13 + ct.length);
  out[0] = 1;
  out.set(iv, 1);
  out.set(ct, 13);
  return bytesToB64(out);
}

// ─── Step 5: episode query over the signed GET path ───────────
async function decryptTobeparsed(
  b64: string,
  keys: Uint8Array[],
): Promise<{ episode?: { sourceUrls?: SourceUrl[] } } | null> {
  let raw: Uint8Array;
  try {
    raw = b64ToBytes(b64);
  } catch {
    return null;
  }
  if (raw.length < 32 || raw[0] !== 1) return null;
  const iv = raw.slice(1, 13);
  const tag = raw.slice(raw.length - 16);
  const ct = raw.slice(13, raw.length - 16);
  const body = new Uint8Array(ct.length + 16);
  body.set(ct);
  body.set(tag, ct.length);
  for (const keyBytes of keys) {
    try {
      const key = await importGcmKey(keyBytes, ["decrypt"]);
      const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, body);
      return JSON.parse(new TextDecoder().decode(pt));
    } catch {
      // try next key
    }
  }
  return null;
}

function sourceUrlsFrom(json: Record<string, unknown>): SourceUrl[] {
  const data = json.data as
    | { tobeparsed?: string; episode?: { sourceUrls?: SourceUrl[] } }
    | undefined;
  if (data?.episode?.sourceUrls && data.episode.sourceUrls.length > 0) {
    return data.episode.sourceUrls;
  }
  return [];
}

async function signedEpisodeQuery(
  showId: string,
  episodeString: string,
  translationType: "sub" | "dub",
): Promise<{ sources: SourceUrl[] | null; error?: string }> {
  const mask = deriveMask(buildId());
  const boot = await getBootState(mask);
  if (!boot) return { sources: null, error: "bootstrap unavailable" };

  const api = RT().aaApi || "https://api.mkissa.net/api";
  const variables = JSON.stringify({ showId, translationType, episodeString });
  const buildExtensions = async (ts: number) =>
    JSON.stringify({
      persistedQuery: { version: 1, sha256Hash: EPISODE_QUERY_HASH },
      k: lane(),
      aaReq: await buildAaReq(boot.keyBytes, boot.state.epoch, EPISODE_QUERY_HASH, ts),
    });

  for (let attempt = 0; attempt < 2; attempt++) {
    const ts = Math.floor(Date.now() / TS_BUCKET_MS) * TS_BUCKET_MS;
    try {
      // BUG-FIX: buildExtensions (buildAaReq → crypto.subtle) used to run
      // BEFORE the try — a WebCrypto failure escaped signedEpisodeQuery as an
      // unhandled rejection and the route died with a bare 500 instead of the
      // graceful { error } shape (and the client's legacy fallback).
      const extensions = await buildExtensions(ts);
      const url = `${api}?variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          "User-Agent": UA,
          Referer: `https://${BOOT_HOST}/`,
          Origin: `https://${BOOT_HOST}`,
          "x-build-id": buildId(),
          Accept: "*/*",
        },
      });
      if (!res.ok) {
        return { sources: null, error: `mkissa API HTTP ${res.status}` };
      }
      const json = (await res.json()) as Record<string, unknown>;
      let sources = sourceUrlsFrom(json);
      if (sources.length === 0) {
        // Encrypted tobeparsed — decrypt with the derived key, then legacy key
        const data = json.data as { tobeparsed?: string } | undefined;
        const legacyKey = await getLegacyKey();
        const keys = legacyKey ? [boot.keyBytes, legacyKey] : [boot.keyBytes];
        if (data?.tobeparsed) {
          const decrypted = await decryptTobeparsed(data.tobeparsed, keys);
          sources = decrypted?.episode?.sourceUrls ?? [];
        }
      }
      if (sources.length > 0) return { sources };
      // NEED_CAPTCHA / gate errors — a fresh aaReq occasionally clears it
      const errs = json.errors as Array<{ message?: string }> | undefined;
      const msg = errs?.[0]?.message || "no sources";
      if (attempt === 0 && /captcha|crypto|stale/i.test(msg)) continue;
      return { sources: null, error: `mkissa API: ${msg}` };
    } catch (err) {
      if (attempt === 1) {
        return { sources: null, error: err instanceof Error ? err.message : String(err) };
      }
    }
  }
  return { sources: null, error: "mkissa API exhausted" };
}

// Legacy fallback: the pre-aaReq key still decrypts tobeparsed on some
// deployments, and the unsigned GET query still works for search.
let legacyKeyCache: Uint8Array | null = null;
async function getLegacyKey(): Promise<Uint8Array | null> {
  if (legacyKeyCache) return legacyKeyCache;
  try {
    legacyKeyCache = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(LEGACY_KEY_STR)));
    return legacyKeyCache;
  } catch {
    return null;
  }
}

// ─── Legacy unsigned episode query (api.allanime.day) ─────────
async function legacyEpisodeQuery(
  showId: string,
  episodeString: string,
  translationType: "sub" | "dub",
): Promise<{ sources: SourceUrl[] | null; error?: string }> {
  const variables = JSON.stringify({ showId, episodeString, translationType });
  const extensions = JSON.stringify({
    persistedQuery: { version: 1, sha256Hash: LEGACY_EPISODE_HASH },
  });
  const url = `${RT().allanimeApi}?variables=${encodeURIComponent(variables)}&extensions=${encodeURIComponent(extensions)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        "User-Agent": UA,
        Referer: `${RT().allanimeReferer}`,
        Origin: RT().allanimeOrigin,
        Accept: "*/*",
      },
    });
    if (!res.ok) return { sources: null, error: `legacy API HTTP ${res.status}` };
    const json = (await res.json()) as Record<string, unknown>;
    let sources = sourceUrlsFrom(json);
    if (sources.length === 0) {
      const data = json.data as { tobeparsed?: string } | undefined;
      const legacyKey = await getLegacyKey();
      if (data?.tobeparsed && legacyKey) {
        const decrypted = await decryptTobeparsed(data.tobeparsed, [legacyKey]);
        sources = decrypted?.episode?.sourceUrls ?? [];
      }
    }
    if (sources.length > 0) return { sources };
    const errs = json.errors as Array<{ message?: string }> | undefined;
    return { sources: null, error: `legacy API: ${errs?.[0]?.message || "no sources"}` };
  } catch (err) {
    return { sources: null, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Response cache + main resolver ───────────────────────────
const responseCache = new Map<string, { sources: SourceUrl[]; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key: string): SourceUrl[] | null {
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.sources;
  if (cached) responseCache.delete(key);
  return null;
}

function setCached(key: string, sources: SourceUrl[]) {
  responseCache.set(key, { sources, expiresAt: Date.now() + CACHE_TTL_MS });
  if (responseCache.size > 100) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
}

export async function fetchAllAnimeEpisodeDirect(
  showId: string,
  episodeString: string,
  translationType: "sub" | "dub",
): Promise<EpisodeResolveResult> {
  const cacheKey = `${showId}:${episodeString}:${translationType}`;
  const cached = getCached(cacheKey);
  if (cached) return { sources: cached, cached: true, error: undefined };

  // Primary: the current signed mkissa.net scheme (boot token + aaReq).
  const signed = await signedEpisodeQuery(showId, episodeString, translationType);
  if (signed.sources && signed.sources.length > 0) {
    setCached(cacheKey, signed.sources);
    return { sources: signed.sources, cached: false, error: undefined };
  }

  // Fallback: legacy unsigned query.
  const legacy = await legacyEpisodeQuery(showId, episodeString, translationType);
  if (legacy.sources && legacy.sources.length > 0) {
    setCached(cacheKey, legacy.sources);
    return { sources: legacy.sources, cached: false, error: undefined };
  }

  return {
    sources: null,
    error: [signed.error, legacy.error].filter(Boolean).join(" | ") || "no sources",
  };
}
