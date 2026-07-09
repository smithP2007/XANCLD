// AllAnime mkissa.to direct-crypto resolver — ported from XAN/cf-worker/worker.js
//
// As of mid-2026, AllAnime migrated from allmanga.to to mkissa.to and now
// requires a signed `aaReq` extension on every episode GraphQL query.
// Without it, the server returns `AA_CRYPTO_MISSING` and zero sources.
//
// The crypto scheme (reverse-engineered from mkissa.to's SvelteKit bundle):
//
//   1. AllAnime embeds window.__aaCrypto = {epoch, partB} in the page HTML
//      (mkissa.to returns 200 with no Cloudflare challenge)
//   2. The AES key is derived: key = XOR(atob(partB), hexToBytes(MASK))
//      where MASK = "5ddc3a1ac04f5b0ae3f33bce61f78e4c209bb2a850d9c5d7dad9c2706d99a34d"
//   3. For each episode query, build a signed "aaReq" extension:
//      a. ts = Math.floor(Date.now() / 300000) * 300000  (5-min bucket)
//      b. payload = JSON.stringify({v:1, ts, epoch, buildId:"9", qh:queryHash})
//      c. iv = SHA-256(epoch + ":" + buildId + ":" + queryHash + ":" + ts).slice(0, 12)
//      d. encrypted = AES-GCM-encrypt(key, iv, payload)
//      e. aaReq = base64([0x01][iv(12)][encrypted+tag])
//   4. POST to https://api.allanime.day/api with:
//      - body: {query, variables, extensions: {persistedQuery, aaReq}}
//      - headers: Content-Type: application/json, x-build-id: "9"
//   5. Server returns tobeparsed (encrypted with the same key, AES-GCM)
//      — the OLD sha256("Xot36i3lK3:v1") key still works as a fallback
//   6. Decrypt tobeparsed → {episode: {sourceUrls: [...]}}

// ⚠️ The MASK changes when mkissa.to deploys a new build. If AA_CRYPTO_STALE
// persists even after refreshing __aaCrypto, check if the MASK has changed:
//   1. Fetch https://mkissa.to/ and find the main JS chunk URL
//   2. Search the chunks for: const Dn=mt(362)!=="string"?"<64-char hex>":""
//   3. Update MASK_HEX and BUILD_ID below and redeploy
// Last verified: 2026-07-09 — MASK=78ebe405..., BUILD_ID=12
const MASK_HEX = "78ebe40583e4f360cd9f56926b775a780054367c826123dcd0577a231eee4e73";
const BUILD_ID = "12";
const OLD_KEY_STR = "Xot36i3lK3:v1";
const ALLANIME_API = "https://api.allanime.day/api";
const MKISSA_EPISODE_URL = (showId: string, ep: string, mode: string) =>
  `https://mkissa.to/watch/${showId}/p-${ep}-${mode}`;

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

// ─── Helpers ──────────────────────────────────────────────────
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function sha256(str: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

async function sha256Hex(str: string): Promise<string> {
  const hash = await sha256(str);
  return Array.from(hash)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getOldKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(OLD_KEY_STR));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["decrypt"]);
}

// Derive the AES key: key = XOR(atob(partB), maskBytes)
async function deriveAesKey(partB: string): Promise<CryptoKey> {
  const maskBytes = hexToBytes(MASK_HEX);
  const partBBytes = Uint8Array.from(atob(partB), (c) => c.charCodeAt(0));
  if (partBBytes.length < 32) throw new Error("partB too short");
  const keyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    keyBytes[i] = partBBytes[i] ^ maskBytes[i % maskBytes.length];
  }
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

// Build the aaReq signed proof: base64([0x01][iv(12)][encrypted+tag])
async function buildAaReq(queryHash: string, epoch: string, aesKey: CryptoKey): Promise<string> {
  const ts = Math.floor(Date.now() / 300000) * 300000; // 5-min bucket
  const payload = JSON.stringify({ v: 1, ts, epoch, buildId: BUILD_ID, qh: queryHash });
  const ivSource = `${epoch}:${BUILD_ID}:${queryHash}:${ts}`;
  const ivHash = await sha256(ivSource);
  const iv = ivHash.slice(0, 12);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    new TextEncoder().encode(payload),
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const result = new Uint8Array(1 + 12 + encryptedBytes.length);
  result[0] = 1;
  result.set(iv, 1);
  result.set(encryptedBytes, 13);
  let binary = "";
  for (let i = 0; i < result.length; i++) binary += String.fromCharCode(result[i]);
  return btoa(binary);
}

// Fetch window.__aaCrypto from mkissa.to episode page HTML
async function fetchAaCrypto(
  showId: string,
  episodeString: string,
  translationType: string,
): Promise<{ epoch: string; partB: string }> {
  const url = MKISSA_EPISODE_URL(showId, episodeString, translationType);
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) {
    throw new Error(`mkissa.to returned HTTP ${res.status}`);
  }
  const html = await res.text();
  const match = html.match(/window\.__aaCrypto\s*=\s*(\{[^}]+\})/);
  if (!match) {
    throw new Error("__aaCrypto not found in mkissa.to page HTML");
  }
  const aaCrypto = JSON.parse(match[1]);
  if (!aaCrypto.partB || !aaCrypto.epoch) {
    throw new Error(`__aaCrypto missing required fields: ${JSON.stringify(aaCrypto)}`);
  }
  return aaCrypto;
}

// Decrypt tobeparsed (try new key first, fall back to OLD sha256("Xot36i3lK3:v1"))
async function decryptTobeparsed(b64: string, newKey: CryptoKey): Promise<unknown> {
  try {
    const binaryStr = atob(b64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    if (bytes.length < 32 || bytes[0] !== 1) return null;
    const iv = bytes.slice(1, 13);
    const ctWithTag = bytes.slice(13);

    // Try NEW key first (mkissa.to's primary path)
    try {
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        newKey,
        ctWithTag,
      );
      return JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
      // fall through to old key
    }

    // Fallback: OLD key
    try {
      const oldKey = await getOldKey();
      const plaintext = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        oldKey,
        ctWithTag,
      );
      return JSON.parse(new TextDecoder().decode(plaintext));
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

// ─── In-memory caches ─────────────────────────────────────────
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

// Cache for __aaCrypto + derived AES key (1 hour TTL — refreshes on AA_CRYPTO_STALE)
const AA_CRYPTO_CACHE_TTL_MS = 60 * 60 * 1000;
let aaCryptoCache: {
  aaCrypto: { epoch: string; partB: string };
  aesKey: CryptoKey;
  expiresAt: number;
} | null = null;

async function getAaCryptoAndKey(
  showId: string,
  episodeString: string,
  translationType: string,
) {
  if (aaCryptoCache && aaCryptoCache.expiresAt > Date.now()) {
    return aaCryptoCache;
  }
  const aaCrypto = await fetchAaCrypto(showId, episodeString, translationType);
  const aesKey = await deriveAesKey(aaCrypto.partB);
  aaCryptoCache = {
    aaCrypto,
    aesKey,
    expiresAt: Date.now() + AA_CRYPTO_CACHE_TTL_MS,
  };
  return aaCryptoCache;
}

// ─── Episode query (exact fields mkissa.to expects) ───────────
// The server rejects smaller queries with "Cannot set properties of undefined"
const EPISODE_QUERY = `query(
$showId: String!
$translationType: VaildTranslationTypeEnumType!
$episodeString: String!
) {
episode(
showId: $showId
translationType: $translationType
episodeString: $episodeString
) {
episodeString
uploadDate
sourceUrls
thumbnail
notes
show{
_id
name
englishName
nativeName
slugTime
thumbnail
lastEpisodeInfo
lastEpisodeDate
type
season
score
airedStart
availableEpisodes
episodeDuration
episodeCount
lastUpdateEnd
characterCount
description
broadcastInterval
banner
characters
availableEpisodesDetail
nameOnlyString
isAdult
relatedShows
relatedMangas
altNames
disqusIds
}
pageStatus{
_id
notes
pageId
showId
views
likesCount
commentCount
dislikesCount
reviewCount
userScoreCount
userScoreTotalValue
userScoreAverValue
}
episodeInfo{
notes
thumbnails
vidInforssub
uploadDates
vidInforsdub
vidInforsraw
description
}
versionFix
}
}`;

// ─── Main resolver ────────────────────────────────────────────
export async function fetchAllAnimeEpisodeDirect(
  showId: string,
  episodeString: string,
  translationType: "sub" | "dub",
): Promise<EpisodeResolveResult> {
  const cacheKey = `${showId}:${episodeString}:${translationType}`;

  const cached = getCached(cacheKey);
  if (cached) {
    return { sources: cached, cached: true, error: undefined };
  }

  try {
    // Step 1: Get __aaCrypto from mkissa.to
    const { aaCrypto, aesKey } = await getAaCryptoAndKey(
      showId,
      episodeString,
      translationType,
    );

    // Step 2: Compute query hash
    const queryHash = await sha256Hex(EPISODE_QUERY);

    // Step 3: Build aaReq signed proof
    const aaReq = await buildAaReq(queryHash, aaCrypto.epoch, aesKey);

    // Step 4: POST to api.allanime.day/api
    const body = {
      query: EPISODE_QUERY,
      variables: { showId, episodeString, translationType },
      extensions: {
        persistedQuery: { version: 1, sha256Hash: queryHash },
        aaReq,
      },
    };

    const res = await fetch(ALLANIME_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Referer: "https://mkissa.to/",
        Origin: "https://mkissa.to",
        "x-build-id": BUILD_ID,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        sources: null,
        error: `AllAnime API HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    const json: Record<string, unknown> = await res.json();

    if (json.errors && (json.errors as Array<Record<string, unknown>>)[0]) {
      const err = (json.errors as Array<Record<string, unknown>>)[0];
      const errCode = (err.extensions as { code?: string })?.code ?? "";
      const errMsg = (err.message as string) ?? "Unknown error";

      // If crypto is rejected (STALE, BUILD_MISMATCH), refresh __aaCrypto and retry
      if (errCode.startsWith("AA_CRYPTO")) {
        aaCryptoCache = null;
        const freshCrypto = await getAaCryptoAndKey(
          showId,
          episodeString,
          translationType,
        );
        const freshAaReq = await buildAaReq(queryHash, freshCrypto.aaCrypto.epoch, freshCrypto.aesKey);

        const retryRes = await fetch(ALLANIME_API, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            Referer: "https://mkissa.to/",
            Origin: "https://mkissa.to",
            "x-build-id": BUILD_ID,
          },
          body: JSON.stringify({
            query: EPISODE_QUERY,
            variables: { showId, episodeString, translationType },
            extensions: {
              persistedQuery: { version: 1, sha256Hash: queryHash },
              aaReq: freshAaReq,
            },
          }),
        });

        if (retryRes.ok) {
          const retryJson: Record<string, unknown> = await retryRes.json();
          if (!retryJson.errors) {
            const retryData = retryJson.data as
              | { tobeparsed?: string; episode?: { sourceUrls?: SourceUrl[] } }
              | undefined;
            if (retryData?.tobeparsed) {
              const decrypted = (await decryptTobeparsed(
                retryData.tobeparsed,
                freshCrypto.aesKey,
              )) as { episode?: { sourceUrls?: SourceUrl[] } } | null;
              const sources = decrypted?.episode?.sourceUrls ?? [];
              if (sources.length > 0) {
                setCached(cacheKey, sources);
                return { sources, cached: false, error: undefined };
              }
            }
            if (retryData?.episode?.sourceUrls) {
              const sources = retryData.episode.sourceUrls;
              setCached(cacheKey, sources);
              return { sources, cached: false, error: undefined };
            }
          }
        }

        return {
          sources: null,
          error: `AllAnime GraphQL: ${errMsg} (${errCode}) — retry also failed`,
        };
      }

      return { sources: null, error: `AllAnime GraphQL: ${errMsg} (${errCode})` };
    }

    // Step 5: Decrypt tobeparsed (try new key, fall back to old)
    const data = json.data as
      | { tobeparsed?: string; episode?: { sourceUrls?: SourceUrl[] } }
      | undefined;

    if (data?.tobeparsed) {
      const decrypted = (await decryptTobeparsed(data.tobeparsed, aesKey)) as
        | { episode?: { sourceUrls?: SourceUrl[] } }
        | null;
      const sources = decrypted?.episode?.sourceUrls ?? [];
      if (sources.length === 0) {
        return { sources: null, error: "tobeparsed decrypted but no sourceUrls" };
      }
      setCached(cacheKey, sources);
      return { sources, cached: false, error: undefined };
    }

    if (data?.episode?.sourceUrls) {
      const sources = data.episode.sourceUrls;
      setCached(cacheKey, sources);
      return { sources, cached: false, error: undefined };
    }

    return { sources: null, error: "No sourceUrls in response" };
  } catch (err) {
    return {
      sources: null,
      error: `Direct crypto failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
