import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  SkipForward,
  Star,
  Tv,
  Volume2,
  Sun,
  Eye,
  EyeOff,
  Maximize,
  List,
  RotateCw,
  AlertTriangle,
} from "lucide-react";
import { fetchAnimeDetail, getTitle, type AnimeDetail } from "../lib/anilist";
import {
  findShowByAniListId,
  extractStreamUrl,
  type StreamResult,
} from "../lib/allanime";
// gogoanime removed
import { getKotoSource } from "../lib/providers/koto";
import { fetchZenSources } from "../lib/providers/zen";
import {
  resolveAnimexShow,
  fetchAnimexServers,
  fetchAnimexSources,
  animexProviderDisplayName,
  type AnimexServerInfo,
  type AnimexSource,
} from "../lib/providers/animex";
import { isZenEmbedUrl, buildZenEmbedUrl, useZenBridge } from "../lib/zenBridge";
import { useSettings, addToHistory, getHistory } from "../hooks/useSettings";
import { useAnimeList } from "../hooks/useAnimeList";
import { useVideoEnhancer } from "../hooks/useVideoEnhancer";
import { VideoEnhancerPanel } from "../components/VideoEnhancerPanel";
import { VideoPlayer } from "../components/VideoPlayer";
import { EpisodePickerSheet } from "../components/EpisodePickerSheet";
import { EpisodePanel } from "../components/EpisodePanel";
import { ProviderSelector, type ProviderChip, type SourceChip } from "../components/ProviderSelector";

// L-21 FIX: "demo" is its own provider tier so the Big Buck Bunny fallback
// no longer masquerades under the "AllAnime" group in the Servers panel.
// "animex" is the per-episode provider family modeled on animex.one
// (Zoro / Yuki / Loli / Sora — direct HLS from pp.animex.one). Each chip is
// one server inside that family; the selected one lives in animexProviderId.
type Provider = "allanime" | "koto" | "zen" | "animex" | "demo";

interface UnifiedSource {
  url: string;
  type: "hls" | "mp4" | "iframe";
  quality: string | null;
  sourceName: string;
  provider: Provider;
  // AnimeX per-episode sources carry their raw provider id ("yuki") so the
  // chip grid can highlight the active server within the animex family.
  providerId?: string;
  // Soft-subtitle tracks (proxied VTT) — only AnimeX sources ship these.
  tracks?: { url: string; label: string; lang: string; isDefault?: boolean }[];
}

// H-6 FIX: bandwidthMode was a dead setting — persisted by Settings but read
// NOWHERE, so "Direct only"/"Proxy only" did absolutely nothing.
//   direct-only : iframe embeds (Koto/Zen) are excluded entirely — iframes
//                 load third-party JS and bypass the worker completely
//   proxy-only  : direct streams (mp4/hls) are ordered FIRST — MP4 sources
//                 already stream through /api/stream, maximizing the
//                 Worker-proxied path; iframes remain as last resort
//   auto        : unchanged (providers' own priority order)
function applyBandwidthMode(
  sources: UnifiedSource[],
  mode: "auto" | "direct-only" | "proxy-only",
): UnifiedSource[] {
  if (mode === "direct-only") return sources.filter((s) => s.type !== "iframe");
  if (mode === "proxy-only") {
    return [...sources].sort(
      (a, b) => (a.type === "iframe" ? 1 : 0) - (b.type === "iframe" ? 1 : 0),
    );
  }
  return sources;
}

// Token-insensitive stream identity for dedup. The AnimeX servers sign every
// /sources response with a FRESH rotating token in the stream URL's query, so
// the same Yuki/Sora stream resolves to two different URLs when both the main
// provider path and the servers-effect aggregation fetch it — a raw URL Set
// kept BOTH copies as duplicate chips. Identity for animex sources is the
// server id + URL path (token-independent); everything else uses the raw url.
function streamIdentity(s: UnifiedSource): string {
  if (s.provider === "animex" && s.providerId) {
    let path = s.url;
    try {
      const wrapped = new URL(s.url, "http://x");
      const real = wrapped.searchParams.get("url") ?? "";
      path = real ? new URL(real).pathname : s.url;
    } catch {
      // fall through with the raw url
    }
    return `animex:${s.providerId}:${path}`;
  }
  return s.url;
}

// Check if ALL source names from a provider are disabled — if so, skip loading that provider entirely
function isProviderFullyDisabled(prov: Provider, disabledSources: string[]): boolean {
  if (prov === "koto") return disabledSources.includes("Koto");
  if (prov === "zen") return disabledSources.includes("Zen") && disabledSources.includes("Zen (Dual→Dub)");
  // gogoanime removed
  // allanime: source names are dynamic (Mp4, Ok, etc.) — can't know in advance, so still load it
  // animex: per-episode servers are dynamic too (Yuki/Loli/Sora/Zoro) — same reasoning
  return false;
}

export function Watch() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // L-11 FIX: `?ep=abc` parsed to NaN — the header showed "EP NaN", providers
  // were queried with String(NaN), and history lookups never matched. Clamp
  // to a positive integer, defaulting to 1.
  const parsedEp = parseInt(searchParams.get("ep") || "1", 10);
  const episode = Number.isFinite(parsedEp) && parsedEp >= 1 ? parsedEp : 1;
  // L-18 FIX: the command menu's continue-watching entries link with an
  // explicit &t=<seconds> timestamp that Watch never parsed — such a click
  // silently started from 0:00 (or from the autoResume lookup). Honor it.
  const parsedT = parseFloat(searchParams.get("t") || "");
  const resumeOverride = Number.isFinite(parsedT) && parsedT > 5 ? parsedT : undefined;
  const animeId = parseInt(id || "0", 10);

  const [settings] = useSettings();
  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [stream, setStream] = useState<UnifiedSource | null>(null);
  const [allSources, setAllSources] = useState<UnifiedSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"sub" | "dub">(settings.defaultMode);
  const [resumeTime, setResumeTime] = useState<number | undefined>(undefined);
  const [provider, setProvider] = useState<Provider>(settings.preferredProvider);
  // AnimeX per-episode provider family (Zoro / Yuki / Loli / Sora):
  // slug = animex.one's internal show id, resolved once per anime; servers =
  // per-episode availability list for the CURRENT audio mode;
  // animexProviderId = which per-episode server the "animex" provider loads.
  const [animexSlug, setAnimexSlug] = useState<string | null>(null);
  const [animexServers, setAnimexServers] = useState<AnimexServerInfo[]>([]);
  const [animexServersLoading, setAnimexServersLoading] = useState(false);
  const [animexProviderId, setAnimexProviderId] = useState<string>("yuki");
  // Per-server load outcome for THIS episode ("yuki": "done", "loli": "error")
  // — drives the individual status dots on the per-episode server chips, so a
  // dead upstream server (pp.animex.one 500s for Loli these days) is visible
  // at a glance while the working servers stay clickable.
  const [animexServerStatus, setAnimexServerStatus] = useState<Record<string, "done" | "error">>({});

  // H-4 FIX: Sync provider state with settings — if the user changes their
  // preferred provider in Settings mid-session, the Watch page should pick
  // up the new preference on next render.
  useEffect(() => {
    setProvider(settings.preferredProvider);
  }, [settings.preferredProvider]);

  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [showEnhancer, setShowEnhancer] = useState(false);
  // L-12 FIX: the Stream Unavailable / demo-fallback states had no retry —
  // the user's only recovery was a full page reload. Bumping retryKey re-runs
  // the whole provider-loading effect.
  const [retryKey, setRetryKey] = useState(0);
  // Mobile bottom-sheet episode picker (redesign plan §4)
  const [sheetOpen, setSheetOpen] = useState(false);
  const enhancer = useVideoEnhancer();
  const [providerStatus, setProviderStatus] = useState<Record<Provider, "idle" | "loading" | "done" | "error">>({
    allanime: "idle",
    koto: "idle",
    zen: "idle",
    animex: "idle",
    demo: "idle",
  });

  // Cache AllAnime show ID to avoid re-searching on every episode change
  const allAnimeShowIdRef = useRef<string | null>(null);
  // H-2 FIX: per-run identity for the provider-loading effect. The effect
  // spawns async work that can outlive the run (user clicks episode 2 while
  // episode 1's providers are still resolving). Without a run guard, the OLD
  // run's callbacks fired after the new run reset firstResolvedRef, so the
  // old episode's sources won the race and played under the new episode URL.
  // (The claim logic now uses a per-run local `claimed` flag instead.)
  const runIdRef = useRef(0);

  // Load stream from a specific provider
  // H-2 FIX: isStale() marks a run superseded by a newer one — stale runs
  // must not touch provider status or the AllAnime show-id cache (a late
  // `allAnimeShowIdRef.current = show._id` from the PREVIOUS anime used to
  // poison the cache and stream the wrong show).
  const loadFromProvider = async (prov: Provider, title: string, isStale?: () => boolean) => {
    if (isStale?.()) return [];
    setProviderStatus((prev) => ({ ...prev, [prov]: "loading" }));
    try {
      let sources: UnifiedSource[] = [];

      if (prov === "allanime") {
        // Use cached show ID if available (avoids re-searching on every episode)
        let showId = allAnimeShowIdRef.current;
        if (!showId) {
          const show = await findShowByAniListId(animeId, title);
          if (!show) {
            if (!isStale?.()) setProviderStatus((prev) => ({ ...prev, [prov]: "error" }));
            return [];
          }
          if (!isStale?.()) allAnimeShowIdRef.current = show._id;
          showId = show._id;
        }
        const result = await extractStreamUrl(showId, String(episode), mode);
        sources = result.sources.map((s) => ({
          url: s.url,
          type: s.type,
          quality: s.quality,
          sourceName: s.sourceName,
          provider: "allanime" as const,
        }));
      } else if (prov === "koto") {
        // Koto is a trivial iframe URL builder — always succeeds (no API call)
        const koto = getKotoSource(animeId, episode, mode);
        sources = [koto];
      } else if (prov === "zen") {
        const zenSources = await fetchZenSources(animeId, episode, mode);
        sources = zenSources.map((s) => ({
          url: s.url,
          type: s.type,
          quality: s.quality,
          sourceName: s.sourceName,
          provider: "zen" as const,
        }));
      } else if (prov === "animex") {
        // AnimeX per-episode server (Zoro / Yuki / Loli / Sora / Nero …). The
        // slug normally arrives before this runs (the servers effect below),
        // but resolve on demand as a fallback so a direct chip click on a
        // fresh page still works.
        let slug = animexSlug;
        if (!slug) {
          slug = await resolveAnimexShow(animeId, episode);
          if (!slug) {
            if (!isStale?.()) setProviderStatus((prev) => ({ ...prev, [prov]: "error" }));
            return [];
          }
          if (!isStale?.()) setAnimexSlug(slug);
        }
        // Selected server only — this drives the playback claim race. The
        // OTHER per-episode servers are aggregated by the servers effect
        // (without restarting playback) so the Sources row lists every
        // working stream.
        const got = await fetchAnimexSources(slug, episode, mode, animexProviderId);
        if (!isStale?.()) {
          setAnimexServerStatus((prev) => ({
            ...prev,
            [animexProviderId]: got.length > 0 ? "done" : "error",
          }));
        }
        sources = got.map((s) => ({
          url: s.url,
          type: s.type,
          quality: s.quality,
          sourceName: s.sourceName,
          provider: "animex" as const,
          providerId: s.providerId,
          tracks: s.tracks.map((t) => ({
            url: t.url,
            label: t.label,
            lang: t.lang,
            isDefault: t.isDefault,
          })),
        }));
      }

      // H-6 FIX: apply bandwidthMode BEFORE computing provider status so the
      // dots reflect what actually remains (direct-only + Koto-only = red dot).
      const finalSources = applyBandwidthMode(sources, settings.bandwidthMode);
      if (!isStale?.()) {
        setProviderStatus((prev) => ({ ...prev, [prov]: finalSources.length > 0 ? "done" : "error" }));
      }
      return finalSources;
    } catch (err) {
      console.error(`[${prov}] failed:`, err);
      if (!isStale?.()) setProviderStatus((prev) => ({ ...prev, [prov]: "error" }));
      return [];
    }
  };

  useEffect(() => {
    if (!animeId) return;
    // H-2 FIX: claim this run. Every async callback below checks isStale()
    // before touching state/refs, so a superseded run (user switched
    // episode/anime while providers were resolving) can no longer:
    //   - merge its sources into the new episode's picker
    //   - win the firstResolved race and play the OLD episode
    //   - write a foreign AllAnime show id into the cache
    const runId = ++runIdRef.current;
    const isStale = () => runId !== runIdRef.current;
    setAutoPlayNext(false);
    // Reset resume position when episode changes — otherwise switching from
    // ep 1 (saved at 5:00) to ep 2 would carry over ep 1's resume point.
    setResumeTime(undefined);
    allAnimeShowIdRef.current = null; // H-3: Clear cached show ID on episode/mode change
    (async () => {
      setLoading(true);
      setError(null);
      setStream(null);
      setAllSources([]);
      setProviderStatus({ allanime: "idle", koto: "idle", zen: "idle", animex: "idle", demo: "idle" });
      setAnimexServerStatus({});

      try {
        const detail = await fetchAnimeDetail(animeId);
        if (!detail) {
          setError("Anime not found");
          setLoading(false);
          return;
        }
        setAnime(detail);
        const title = getTitle(detail.title);
        if (!title.trim()) {
          setError("No title available");
          setLoading(false);
          return;
        }

        // Check history for resume position.
        // FIX (redesign plan §4): if the saved timestamp is in the last ~8%
        // of duration (or within the last 45 seconds), don't resume at that
        // exact point — the user has effectively finished the episode.
        // Restart from 0 instead. This avoids the annoying case where the
        // user lands 2 seconds before the credits and has to manually click
        // "next episode".
        // M-19 FIX: the "Auto-resume from last position" toggle was a dead
        // setting — this lookup ran unconditionally, so disabling it in
        // Settings changed nothing. Honor it now.
        // L-18 FIX: an explicit &t= timestamp (command menu continue-watching)
        // wins over the plain history lookup — the user clicked a specific
        // "continue at" position, so honor it regardless of autoResume.
        if (resumeOverride !== undefined) {
          setResumeTime(resumeOverride);
        } else if (settings.autoResume) {
          const history = getHistory();
          const existing = history.find(
            (e) => e.animeId === animeId && e.episode === episode,
          );
          if (existing && existing.timestamp > 5 && existing.duration > 0) {
            const remaining = existing.duration - existing.timestamp;
            const remainingPct = remaining / existing.duration;
            // Within last 8% OR within last 45 seconds → treat as finished
            const nearEnd = remainingPct < 0.08 || remaining < 45;
            if (nearEnd) {
              setResumeTime(undefined);
            } else {
              setResumeTime(existing.timestamp);
            }
          } else {
            setResumeTime(undefined);
          }
        } else {
          setResumeTime(undefined);
        }

        // Try providers in priority order — Koto first (instant, no API call) so
        // the user sees something immediately, then AllAnime (fastest real sources)
        // in the background. When dub is selected, prefer AllAnime first.
        // "animex" (Zoro/Yuki/Loli/Sora direct HLS) sits after AllAnime: real
        // streams, slightly slower resolve (slug + sources round-trips).
        const allProviders: Provider[] = mode === "dub"
          ? ["allanime", "animex", "zen", "koto"]
          : ["koto", "allanime", "animex", "zen"];

        // Filter out providers whose sources are ALL disabled — don't even load them
        const activeProviders = allProviders.filter((prov) => !isProviderFullyDisabled(prov, settings.disabledSources));
        const orderedProviders: Provider[] = [
          provider,
          ...activeProviders.filter((p) => p !== provider),
        ];
        // If the user's preferred provider is disabled, remove it from the front
        const finalOrderedProviders = orderedProviders.filter((p) => activeProviders.includes(p));
        if (finalOrderedProviders.length === 0 && !settings.pinnedSource) {
          setError("All sources are disabled. Enable at least one source in Settings > Bandwidth.");
          setLoading(false);
          return;
        }

        // When a source is pinned, we need to find it. BUG 7 FIX: the old
        // loop walked EVERY provider sequentially — including providers the
        // user explicitly disabled in Settings > Source filters — and kept
        // querying the remaining providers even after the pinned source was
        // already in hand. Now: disabled providers are skipped up-front, and
        // the loop breaks the moment the pinned source is found.
        if (settings.pinnedSource) {
          console.log(`[Watch] Pinned source "${settings.pinnedSource}" — searching providers for it`);
          let allCollectedSources: UnifiedSource[] = [];
          let pinnedFound = false;
          for (const prov of allProviders) {
            // BUG 7 FIX (a): never query a provider whose sources are all disabled
            if (isProviderFullyDisabled(prov, settings.disabledSources)) continue;
            const provSources = await loadFromProvider(prov, title, isStale);
            if (isStale()) return;
            allCollectedSources = [...allCollectedSources, ...provSources];
            // BUG 7 FIX (b): stop the moment the pinned source is available —
            // no over-fetching of the remaining providers
            if (provSources.some((s) => s.sourceName === settings.pinnedSource)) {
              pinnedFound = true;
              break;
            }
          }

          // Deduplicate by URL
          const seenUrls = new Set<string>();
          allCollectedSources = allCollectedSources.filter((s) => {
            if (seenUrls.has(s.url)) return false;
            seenUrls.add(s.url);
            return true;
          });

          setAllSources(allCollectedSources);

          // Filter for the pinned source
          const pinnedSources = allCollectedSources.filter((s) => s.sourceName === settings.pinnedSource);
          if (pinnedSources.length === 0) {
            console.log(`[Watch] Pinned source "${settings.pinnedSource}" not available from any enabled provider (found=${pinnedFound})`);
            setError(`Pinned source "${settings.pinnedSource}" is not available for this episode. Unpin it in Settings to use other sources.`);
            setLoading(false);
            return;
          }

          console.log(`[Watch] Pinned source "${settings.pinnedSource}" found (${pinnedSources.length} matches)`);
          setStream(pinnedSources[0]);
          setLoading(false);
          return;
        }

        // ─── PRIORITY-AWARE parallel provider loading ───
        // All providers still load in parallel for speed (Koto instant, Zen a
        // fast CORS proxy, AllAnime the slowest — AES-GCM crypto + multiple
        // API calls), but M-25 FIX: "first resolved wins" used to mean
        // "FASTEST wins" — Koto builds its iframe URL synchronously, so it
        // claimed playback in BOTH sub and dub mode and the dub ordering
        // [allanime, zen, koto] plus the user's preferredProvider never
        // mattered. Now a provider may only CLAIM playback once every
        // higher-priority provider has either resolved (with or without
        // usable sources) or run out of its head-start window. Once claimed,
        // playback is never stolen — later higher-priority sources still
        // populate the server picker. Promise.allSettled keeps one failed
        // provider from rejecting the batch.
        // 3000ms measured: Zen settles in ~0.9–1.2s typically (up to ~2.5s
        // behind Cloudflare variance), AllAnime's failure path can take 2s+.
        // Providers that fail fast unblock lower tiers instantly; the window
        // only ever delays playback when the top-priority provider is still
        // genuinely working — bounded at 3s worst case.
        const PRIORITY_HEAD_START_MS = 3000;
        const claimDeadline = Date.now() + PRIORITY_HEAD_START_MS;
        const settledSources = new Map<Provider, UnifiedSource[]>();
        let claimed = false;
        let claimTimer: number | null = null;

        const pickBest = (provSources: UnifiedSource[]): UnifiedSource | undefined => {
          const directSources = provSources.filter((s) => s.type === "mp4" || s.type === "hls");
          const iframeSources = provSources.filter((s) => s.type === "iframe");
          return directSources[0] ?? iframeSources[0] ?? provSources[0];
        };

        const claimBestSource = () => {
          if (claimed || isStale()) {
            if (claimTimer !== null) {
              clearTimeout(claimTimer);
              claimTimer = null;
            }
            return;
          }
          for (const prov of finalOrderedProviders) {
            const provSources = settledSources.get(prov);
            if (!provSources || provSources.length === 0) {
              // Resolved empty → no longer a contender, skip over. Still
              // pending → it BLOCKS lower-priority tiers, but only inside
              // the head-start window (after the window a slow provider
              // must not hold playback hostage).
              if (!settledSources.has(prov) && Date.now() < claimDeadline) return;
              continue;
            }
            // Claim: clear the deadline timer, mark, start playback.
            if (claimTimer !== null) {
              clearTimeout(claimTimer);
              claimTimer = null;
            }
            claimed = true;
            const best = pickBest(provSources);
            if (best) {
              console.log(`[Watch] ${prov} claimed playback: ${best.sourceName}`);
              setStream(best);
              setLoading(false);
            }
            return;
          }
        };
        claimTimer = window.setTimeout(claimBestSource, PRIORITY_HEAD_START_MS);

        const providerPromises = finalOrderedProviders.map((prov) =>
          // H-8 FIX: the parallel path used to omit isStale — a superseded
          // run's late findShowByAniListId success then wrote its show ID
          // into allAnimeShowIdRef unconditionally (the `!isStale?.()` guard
          // is vacuously true for undefined), so navigating to another anime
          // while a search was still in flight could stream the WRONG show.
          // It also let stale runs scribble provider-status dots.
          loadFromProvider(prov, title, isStale).then((provSources) => ({
            prov,
            sources: provSources.filter((s) => !settings.disabledSources.includes(s.sourceName)),
          })),
        );

        // As each provider resolves, record its sources for the claim walk
        // and populate the server picker immediately.
        providerPromises.forEach((promise) => {
          promise.then(({ prov, sources: provSources }) => {
            // H-2 FIX: drop results from superseded runs
            if (isStale()) return;
            settledSources.set(prov, provSources);
            if (provSources.length > 0) {
              console.log(`[Watch] ${prov} resolved with ${provSources.length} sources`);
              setAllSources((prev) => {
                const existing = new Set(prev.map(streamIdentity));
                const newOnes = provSources.filter(
                  (s) => !existing.has(streamIdentity(s)),
                );
                return [...prev, ...newOnes];
              });
            }
            claimBestSource();
          });
        });

        // Wait for ALL providers to finish (for the server picker), but
        // playback has normally already been claimed by then.
        let sources: UnifiedSource[] = [];
        const results = await Promise.allSettled(providerPromises);
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.sources.length > 0) {
            sources = [...sources, ...result.value.sources];
            break; // We just need at least one set of sources
          }
        }

        // If nothing claimed and no provider produced usable sources, show
        // the explicit demo fallback (H-7) — L-21 FIX: now under its own
        // "demo" provider instead of masquerading as AllAnime.
        if (sources.length === 0 && !claimed) {
          if (isStale()) return;
          console.log("[Watch] All providers failed — adding demo stream fallback");
          const demoSource: UnifiedSource = {
            url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            type: "hls" as const,
            quality: "Demo",
            sourceName: "Demo Stream",
            provider: "demo" as const,
          };
          setAllSources([demoSource]);
          setStream(demoSource);
        }
        if (!isStale()) setLoading(false);
      } catch (err) {
        if (!isStale()) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
        }
      }
    })();
  }, [animeId, episode, mode, provider, animexProviderId, retryKey, resumeOverride]);

  // ─── AnimeX per-episode servers (chips under the player) ───
  // Resolves the animex.one slug once per anime, then fetches the per-episode
  // server list for the current audio mode. The list drives the chip grid —
  // exactly like animex.one, availability differs per episode AND per mode.
  useEffect(() => {
    if (!animeId) return;
    let cancelled = false;
    (async () => {
      setAnimexServersLoading(true);
      setAnimexServers([]);
      try {
        let slug = animexSlug;
        if (!slug) {
          slug = await resolveAnimexShow(animeId, episode);
          if (!slug || cancelled) return;
          setAnimexSlug(slug);
        }
        const servers = await fetchAnimexServers(slug, episode);
        if (cancelled) return;
        const list = mode === "dub" ? servers?.dubProviders : servers?.subProviders;
        setAnimexServers(list ?? []);
        setAnimexServerStatus({});
        // Default the per-episode selection to the server animex.one marks
        // default (usually yuki). Only when nothing is selected yet.
        if (list && list.length > 0) {
          const def = list.find((s) => s.default) ?? list[0];
          setAnimexProviderId((cur) =>
            list.some((s) => s.id === cur) ? cur : def.id,
          );
        }
        // AGGREGATED per-server load — every server this episode offers is
        // fetched in parallel right here (NOT in the main load effect, which
        // would restart playback); all working streams merge into the
        // Sources row at once and each server chip gets its own status dot.
        // A dead upstream server (Loli 500s sitewide right now) simply
        // contributes nothing and shows a red dot — the others still play.
        if (list && list.length > 0) {
          (async () => {
            const perServer = await Promise.allSettled(
              list.map((s) =>
                fetchAnimexSources(slug, episode, mode, s.id).then((r) => ({
                  id: s.id,
                  r,
                })),
              ),
            );
            if (cancelled) return;
            const statusRecord: Record<string, "done" | "error"> = {};
            const collected: AnimexSource[] = [];
            perServer.forEach((res, i) => {
              const id = list[i].id;
              const got = res.status === "fulfilled" ? res.value.r : [];
              statusRecord[id] = got.length > 0 ? "done" : "error";
              collected.push(...got);
            });
            setAnimexServerStatus((prev) => ({ ...prev, ...statusRecord }));
            const fresh = collected
              .filter((s) => s.url)
              .map((s) => ({
                url: s.url,
                type: s.type,
                quality: s.quality,
                sourceName: s.sourceName,
                provider: "animex" as const,
                providerId: s.providerId,
                tracks: s.tracks.map((t) => ({
                  url: t.url,
                  label: t.label,
                  lang: t.lang,
                  isDefault: t.isDefault,
                })),
              }));
            if (fresh.length > 0) {
              setAllSources((prev) => {
                const seen = new Set(prev.map(streamIdentity));
                return [...prev, ...fresh.filter((x) => !seen.has(streamIdentity(x)))];
              });
            }
          })();
        }
      } finally {
        if (!cancelled) setAnimexServersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [animeId, episode, mode, animexSlug]);

  // Filter sources based on user's disabledSources + pinnedSource settings
  const filteredSources = useMemo(() => {
    if (settings.pinnedSource) {
      // Pinned: only show the pinned source
      return allSources.filter((s) => s.sourceName === settings.pinnedSource);
    }
    // Otherwise: filter out disabled sources
    return allSources.filter((s) => !settings.disabledSources.includes(s.sourceName));
  }, [allSources, settings.disabledSources, settings.pinnedSource]);

  // Convert UnifiedSource to StreamResult for VideoPlayer
  // H-1 FIX: memoize by value. This used to be a fresh object literal on every
  // render, and since VideoPlayer keyed its load effect on the stream object,
  // any Watch re-render (background provider resolution, autoplay overlay
  // state…) destroyed and recreated the HLS instance — restarting playback
  // mid-episode. Now the object only changes when the actual source changes.
  const streamForPlayer = useMemo(() => {
    if (!stream) return null;
    return {
      url: stream.url,
      type: stream.type,
      quality: stream.quality,
      sourceName: stream.sourceName,
      provider: stream.provider,
      // Soft-subtitle tracks ride along for AnimeX sources
      ...(stream.tracks && stream.tracks.length > 0 ? { tracks: stream.tracks } : {}),
    };
  }, [stream?.url, stream?.type, stream?.quality, stream?.sourceName, stream?.provider, stream?.tracks]);

  // M-16 FIX: episode-count-unknown handling. `anime.episodes` is null for
  // most airing shows, which used to: hide the Next Episode page button on
  // EP 1 (the `(anime?.episodes || episode > 1)` gate was false), disable the
  // player's Next button + N key, and silence autoplay — all on the shows
  // that need them most. When the total is unknown we now assume a next
  // episode exists; a wrong guess lands on the (now retryable) error state.
  const hasNextEpisode = anime ? (anime.episodes ? episode < anime.episodes : true) : false;

  // ─── Provider chips for the animex.one-style selector under the player ───
  // Unified players first (ANMX = AllAnime, ZEN, KOTO — always available),
  // then the per-episode servers reported by pp.animex.one for the current
  // audio mode. Status dots on the per-episode chips mirror providerStatus.
  const providerChips = useMemo<ProviderChip[]>(() => {
    const unified: ProviderChip[] = [
      { key: "allanime", label: "ANMX" },
      { key: "zen", label: "ZEN" },
      { key: "koto", label: "KOTO" },
    ];
    const familyAttempted = provider === "animex" || providerStatus.animex !== "idle";
    const perEpisode: ProviderChip[] = animexServers.map((s) => ({
      key: s.id,
      label: animexProviderDisplayName(s.id),
      tip: s.tip,
      // Per-server dot: what THIS server's aggregated load returned. Falls
      // back to the family-level status until per-server results exist.
      status: animexServerStatus[s.id] ?? (familyAttempted ? providerStatus.animex : "idle"),
    }));
    return [...unified, ...perEpisode];
  }, [animexServers, provider, providerStatus.animex, animexServerStatus]);

  const activeChipKey = provider === "animex" ? animexProviderId : provider;

  // ─── Source chips — every resolved stream, in the same Sources panel ───
  // The old sidebar "Servers" panel lived here as a separate portion; the
  // sources now ride in the ProviderSelector under the player instead.
  // Deduped by streamIdentity — raw URL dedup kept TWO chips for the same
  // AnimeX stream because every /sources call returns a freshly-signed token.
  const sourceChips = useMemo<SourceChip[]>(() => {
    const seen = new Set<string>();
    const out: SourceChip[] = [];
    for (const s of filteredSources) {
      const id = streamIdentity(s);
      if (seen.has(id)) continue;
      seen.add(id);
      const providerLabel =
        s.provider === "allanime" ? "ANMX"
        : s.provider === "animex" ? "AnimeX"
        : s.provider === "demo" ? "Demo"
        : s.provider.charAt(0).toUpperCase() + s.provider.slice(1);
      const label = s.quality && s.quality !== "auto"
        ? `${s.sourceName} (${s.quality})`
        : s.sourceName;
      out.push({
        key: id,
        label,
        providerLabel,
        type: s.type,
        tip: `${providerLabel} — ${s.sourceName}${s.quality ? ` (${s.quality})` : ""} · ${s.type}`,
      });
    }
    return out;
  }, [filteredSources]);

  const activeSourceKey = stream ? streamIdentity(stream) : null;

  const handleSourceSelect = useCallback(
    (key: string) => {
      const source = filteredSources.find((s) => streamIdentity(s) === key);
      if (source) setStream(source);
    },
    [filteredSources],
  );

  // Chip click — unified providers switch the provider (full reload via the
  // load effect); per-episode servers switch inside the animex family and
  // shortcut to an already-resolved source when one is cached.
  const handleChipSelect = useCallback(
    (key: string) => {
      if (key === "allanime" || key === "zen" || key === "koto") {
        if (provider !== key) setProvider(key as Provider);
        return;
      }
      // Per-episode server — switch into the animex family (the provider
      // change is what re-runs the load effect), then shortcut to an
      // already-resolved source when one is cached.
      const cached = allSources.find(
        (s) => s.provider === "animex" && s.providerId === key,
      );
      setAnimexProviderId(key);
      if (provider !== "animex") {
        setProvider("animex");
      } else if (cached) {
        // Already playing this family — just swap the stream, no reload
        setStream(cached);
      }
    },
    [provider, allSources],
  );

  // L-13 FIX: these handlers used to be inline arrows passed to VideoPlayer,
  // so its 9-listener effect tore down and re-attached on EVERY Watch
  // re-render (background provider resolution, overlay state, …). useCallback
  // keeps identities stable across renders that don't change them.
  // A9 FIX: actually watching an episode never touched the library — the
  // ONLY writer of list status was AnimeStatusButton, so bingeing 5 episodes
  // still left the show absent from MyLibrary. Now ~60s of real playback
  // auto-marks the show WATCHING — both for the <video> path and the Zen
  // iframe path (useZenBridge routes its time reports through the same
  // onProgress). Never overrides an explicit COMPLETED / ON_HOLD / DROPPED
  // choice; PLANNING -> WATCHING is the tracker-standard promotion.
  const { getStatus: getListStatus, setStatus: setListStatus } = useAnimeList();
  // Keep the latest list API in a ref so handleProgress stays identity-stable
  // (getStatus rebinds on every list change; rebinding here would re-attach
  // VideoPlayer's 9-listener effect — the exact regression L-13 fixed).
  const listApiRef = useRef({ getListStatus, setListStatus });
  listApiRef.current = { getListStatus, setListStatus };
  // One-shot per anime per mount (route param changes don't remount Watch).
  const autoMarkedRef = useRef<number | null>(null);
  const handleProgress = useCallback(
    (currentTime: number, duration: number) => {
      if (anime && currentTime > 5 && duration > 0) {
        addToHistory({
          animeId,
          title: getTitle(anime.title),
          coverImage: anime.coverImage?.large ?? "",
          episode,
          timestamp: currentTime,
          duration,
        });
      }
      if (anime && currentTime > 60 && autoMarkedRef.current !== animeId) {
        const currentStatus = listApiRef.current.getListStatus(animeId);
        if (currentStatus === null || currentStatus === "PLANNING") {
          listApiRef.current.setListStatus(
            animeId,
            getTitle(anime.title),
            anime.coverImage?.large ?? "",
            "WATCHING",
          );
        }
        autoMarkedRef.current = animeId;
      }
    },
    [anime, animeId, episode],
  );
  const handleEnded = useCallback(() => {
    if (settings.autoplay && hasNextEpisode) {
      setAutoPlayNext(true);
    }
  }, [settings.autoplay, hasNextEpisode]);
  const handleNext = useCallback(() => {
    if (hasNextEpisode) navigate(`/watch/${animeId}?ep=${episode + 1}`);
  }, [hasNextEpisode, navigate, animeId, episode]);
  const handlePrev = useCallback(() => {
    if (episode > 1) navigate(`/watch/${animeId}?ep=${episode - 1}`);
  }, [navigate, animeId, episode]);
  const handleRetry = useCallback(() => setRetryKey((k) => k + 1), []);

  // ─── Zen (FlixCloud) player bridge — reanime.to feature parity ───
  // reanime decorates the SAME flixcloud embeds with player preferences
  // (start_at resume, skI/skO auto skip, autoPlay, a=1 dub audio) and runs a
  // postMessage bridge for progress/auto-next/fullscreen/error handling.
  // Ported via useZenBridge — see src/web/lib/zenBridge.ts.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [zenPlayerError, setZenPlayerError] = useState(false);

  const isZenStream =
    !!streamForPlayer &&
    streamForPlayer.type === "iframe" &&
    isZenEmbedUrl(streamForPlayer.url);

  const iframeSrc = useMemo(() => {
    if (!streamForPlayer || streamForPlayer.type !== "iframe") return "";
    if (!isZenEmbedUrl(streamForPlayer.url)) return streamForPlayer.url;
    return buildZenEmbedUrl(streamForPlayer.url, {
      startAt: settings.autoResume ? (resumeTime ?? 0) : 0,
      skipIntro: settings.skipIntro,
      skipOutro: settings.skipOutro,
      autoPlay: settings.autoplay,
      dub: mode === "dub",
    });
  }, [
    streamForPlayer,
    settings.autoResume,
    settings.skipIntro,
    settings.skipOutro,
    settings.autoplay,
    mode,
    resumeTime,
  ]);

  // Fresh stream → clear the error banner and reset bridge guards.
  // M-26 FIX: retryKey is part of the identity — Retry re-resolves the SAME
  // zen URL, and without it the stale "player reported an error" banner
  // stayed visible above the freshly remounted iframe.
  useEffect(() => {
    setZenPlayerError(false);
  }, [streamForPlayer?.url, episode, retryKey]);

  // M-28 FIX: the 2s auto-next timer is now tracked and cancelled — the bare
  // setTimeout used to fire after the user left the watch page (or switched
  // episodes) and navigate them to the next episode against their will.
  const zenEndedTimerRef = useRef<number | null>(null);
  const handleZenEnded = useCallback(() => {
    // Iframe players can't render XANCLD's autoplay overlay — mirror
    // reanime: give it a beat, then navigate to the next episode.
    if (settings.autoplay && hasNextEpisode) {
      if (zenEndedTimerRef.current !== null) window.clearTimeout(zenEndedTimerRef.current);
      zenEndedTimerRef.current = window.setTimeout(() => {
        zenEndedTimerRef.current = null;
        navigate(`/watch/${animeId}?ep=${episode + 1}`);
      }, 2000);
    }
  }, [settings.autoplay, hasNextEpisode, navigate, animeId, episode]);
  // Cancel on unmount AND on anime/episode change — route param changes do
  // NOT remount this component, so an unmount-only cleanup would miss it.
  useEffect(() => {
    return () => {
      if (zenEndedTimerRef.current !== null) {
        window.clearTimeout(zenEndedTimerRef.current);
        zenEndedTimerRef.current = null;
      }
    };
  }, [animeId, episode]);
  const handleZenError = useCallback(() => setZenPlayerError(true), []);

  useZenBridge({
    enabled: isZenStream,
    iframeRef,
    streamKey: iframeSrc,
    getFullscreenElement: () => document.getElementById("iframe-player-container"),
    resumeSeconds: settings.autoResume ? (resumeTime ?? 0) : 0,
    skipIntro: settings.skipIntro,
    skipOutro: settings.skipOutro,
    autoPlay: settings.autoplay,
    onProgress: handleProgress,
    onEnded: handleZenEnded,
    onError: handleZenError,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Back button */}
      <Link
        to={`/anime/${animeId}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors glass px-3 py-1.5 rounded-full"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to anime
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* ─── Main column: player + info ─── */}
        <div className="space-y-5">
          {/* Player */}
          {loading ? (
            <div className="aspect-video bg-black rounded-2xl flex flex-col items-center justify-center border border-xan-border">
              <div className="relative">
                <div className="absolute inset-0 bg-xan-crimson/40 blur-xl rounded-full animate-pulse" />
                <div className="relative animate-spin h-12 w-12 border-2 border-xan-crimson border-t-transparent rounded-full" />
              </div>
              <p className="text-sm text-white/80 mt-4 font-medium">
                Loading episode {episode}…
              </p>
              <p className="text-xs text-white/40 mt-1">
                Searching {provider} + decrypting sources
              </p>
            </div>
          ) : error ? (
            <div className="aspect-video bg-black rounded-2xl flex flex-col items-center justify-center border border-xan-border p-6 text-center">
              <p className="font-semibold text-foreground text-lg mb-2">Stream Unavailable</p>
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
              {/* L-12 FIX: retry button — the only recovery used to be a full
                  page reload (or manually picking another server). */}
              <button
                onClick={handleRetry}
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-xan-crimson/20 border border-xan-crimson/40 text-sm font-medium text-foreground hover:bg-xan-crimson/30 transition-colors"
              >
                <RotateCw className="h-4 w-4" /> Retry
              </button>
              {/* Show provider status — L-4 FIX: render ALL providers.
                  Previously this mapped over a hardcoded ["allanime"], so the
                  koto/zen status dots (computed in providerStatus) were never
                  shown while the user was staring at the error panel. */}
              <div className="mt-4 flex items-center gap-3 text-xs">
                {(([
                  "koto",
                  "allanime",
                  "animex",
                  "zen",
                ] as const)).map((p) => (
                  <div key={p} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      providerStatus[p] === "done" ? "bg-green-500" :
                      providerStatus[p] === "error" ? "bg-red-500" :
                      providerStatus[p] === "loading" ? "bg-yellow-500 animate-pulse" :
                      "bg-zinc-600"
                    }`} />
                    <span className="text-muted-foreground">
                      {p === "allanime" ? "ANMX" : p === "animex" ? "AnimeX servers" : p}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : streamForPlayer ? (
            streamForPlayer.type === "iframe" ? (
              <div className="space-y-2">
                {/* Dub hint for dual-audio iframe providers — Zen auto-selects the
                    English track via the a=1 embed param (reanime parity); Koto
                    still needs the manual in-player switch. */}
                {mode === "dub" && streamForPlayer.provider === "zen" && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-xan-crimson/10 border border-xan-crimson/30 text-sm text-foreground">
                    <Volume2 className="h-4 w-4 text-xan-crimson flex-shrink-0" />
                    <span>
                      <strong className="text-xan-crimson">Dub selected:</strong> English audio is
                      auto-selected in this player. If it still plays Japanese, switch tracks via
                      the player's <strong>speaker icon</strong>.
                    </span>
                  </div>
                )}
                {mode === "dub" && streamForPlayer.provider === "koto" && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-xan-crimson/10 border border-xan-crimson/30 text-sm text-foreground">
                    <Volume2 className="h-4 w-4 text-xan-crimson flex-shrink-0" />
                    <span>
                      <strong className="text-xan-crimson">Dub selected:</strong>{" "}
                      This player has dual audio (sub + dub). Click the{" "}
                      <strong>speaker/language icon</strong> inside the player to switch to English dub.
                    </span>
                  </div>
                )}
                {/* Zen player reported a fatal error (postMessage playerStatus:"Error") */}
                {zenPlayerError && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-foreground">
                    <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                    <span className="flex-1">
                      <strong>The Zen player reported an error.</strong> Pick another server below
                      or retry.
                    </span>
                    <button
                      onClick={handleRetry}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-xs font-medium text-foreground hover:bg-red-500/30 transition-colors flex-shrink-0"
                    >
                      <RotateCw className="h-3 w-3" /> Retry
                    </button>
                  </div>
                )}
                {/* Enhancer toggle + eye toggle + fullscreen for iframe */}
                <div className="flex items-center justify-end gap-2">
                  {/* Fullscreen button for iframe */}
                  <button
                    onClick={() => {
                      const container = document.getElementById("iframe-player-container");
                      if (container) {
                        if (document.fullscreenElement) {
                          document.exitFullscreen();
                        } else {
                          container.requestFullscreen();
                        }
                      }
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium glass border border-xan-border hover:border-xan-crimson/30 text-muted-foreground hover:text-foreground transition-all"
                    title="Fullscreen"
                    aria-label="Fullscreen"
                  >
                    <Maximize className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setShowEnhancer(true)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      enhancer.active
                        ? "bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/30"
                        : "glass text-muted-foreground hover:text-foreground border border-xan-border"
                    }`}
                  >
                    <Sun className="h-3.5 w-3.5" />
                    Enhancer
                    {enhancer.active && <span className="w-1.5 h-1.5 rounded-full bg-xan-crimson animate-pulse" />}
                  </button>
                  {/* Eye toggle — always visible, turns enhancer on/off */}
                  <button
                    onClick={enhancer.toggleEnabled}
                    className={`p-1.5 rounded-lg text-xs font-medium transition-all border ${
                      enhancer.state.enabled
                        ? "bg-xan-crimson/20 text-xan-crimson border-xan-crimson/30"
                        : "glass text-muted-foreground hover:text-foreground border-xan-border"
                    }`}
                    title={enhancer.state.enabled ? "Enhancer ON — click to turn off" : "Enhancer OFF — click to turn on"}
                    aria-label={enhancer.state.enabled ? "Turn enhancer off" : "Turn enhancer on"}
                  >
                    {enhancer.state.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-xan-border" id="iframe-player-container">
                  <iframe
                    ref={iframeRef}
                    src={iframeSrc || streamForPlayer.url}
                    className="w-full h-full"
                    style={enhancer.active ? {
                      filter: enhancer.filterCss,
                      willChange: "filter",
                      transform: "translateZ(0)",
                      backfaceVisibility: "hidden",
                    } : undefined}
                    allowFullScreen
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope; web-share"
                    referrerPolicy="no-referrer-when-downgrade"
                    onLoad={() => {
                      // H-5 FIX: iframe players don't report progress, so we
                      // record a 0/0 "started watching" marker — BUT only when
                      // no real progress exists for this episode yet.
                      // addToHistory REPLACES the entry for the same
                      // anime+episode, so an unconditional write here used to
                      // wipe the resume position saved by the direct player
                      // (watch 40 min on an AllAnime source, click the Koto
                      // server → back to 0%).
                      if (anime) {
                        const existing = getHistory().find(
                          (e) => e.animeId === animeId && e.episode === episode,
                        );
                        if (!existing || existing.timestamp <= 5) {
                          addToHistory({
                            animeId,
                            title: getTitle(anime.title),
                            coverImage: anime.coverImage?.large ?? "",
                            episode,
                            timestamp: 0,
                            duration: 0,
                          });
                        }
                      }
                    }}
                  />
                </div>
                {/* Enhancer panel overlay */}
                <VideoEnhancerPanel open={showEnhancer} onClose={() => setShowEnhancer(false)} />
              </div>
            ) : (
              <VideoPlayer
                stream={streamForPlayer}
                title={anime ? getTitle(anime.title) : "Loading..."}
                episode={episode}
                settings={settings}
                resumeTime={resumeTime}
                onProgress={handleProgress}
                onEnded={handleEnded}
                onNext={hasNextEpisode ? handleNext : undefined}
                onPrev={episode > 1 ? handlePrev : undefined}
                autoPlayNext={autoPlayNext}
                onAutoPlayCancel={() => setAutoPlayNext(false)}
                nextEpisodeLabel={
                  anime && hasNextEpisode
                    ? `${getTitle(anime.title)} — Episode ${episode + 1}`
                    : undefined
                }
                onRetry={handleRetry}
              />
            )
          ) : null}

          {/* AnimeX-style Sub/Dub + server chips — sits right under the
              player like on animex.one. Always rendered (even while loading)
              so a stuck stream can be fixed by switching servers without a
              page reload. */}
          <ProviderSelector
            mode={mode}
            onModeChange={setMode}
            chips={providerChips}
            activeKey={activeChipKey}
            onSelect={handleChipSelect}
            serversLoading={animexServersLoading}
            sourceChips={sourceChips}
            activeSourceKey={activeSourceKey}
            onSelectSource={handleSourceSelect}
          />

          {/* H-7 FIX: when every provider fails the page used to silently
              play a public demo video (Big Buck Bunny) with only a tiny badge
              in the player bar — users could mistake it for the episode. Make
              the fallback explicit and offer a retry. */}
          {stream?.sourceName === "Demo Stream" && !loading && !error && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-sm text-foreground">
              <span>
                <strong className="text-amber-500">Fallback stream:</strong> no
                provider could resolve this episode, so a placeholder demo
                video is shown instead of the real episode.
              </span>
              <button
                onClick={handleRetry}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-xs font-medium hover:bg-amber-500/30 transition-colors"
              >
                <RotateCw className="h-3.5 w-3.5" /> Try again
              </button>
            </div>
          )}

          {/* Title + episode info card */}
          {anime && (
            <div className="glass rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full bg-xan-crimson/20 text-xan-crimson font-medium">
                      EP {episode}
                    </span>
                    {anime.format && <span>{anime.format}</span>}
                    {anime.seasonYear && <span>· {anime.seasonYear}</span>}
                  </div>
                  <h1 className="text-xl md:text-2xl font-bold font-display text-foreground">
                    {getTitle(anime.title)}
                  </h1>
                </div>
                {anime.averageScore && (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-xan-card shrink-0">
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-current" />
                    <span className="text-sm font-bold">{Math.round(anime.averageScore)}%</span>
                  </div>
                )}
              </div>
              {anime.description && (
                <p
                  className={`text-sm text-muted-foreground line-clamp-3 leading-relaxed ${
                    // M-15b FIX: honor the "Hide spoilers" setting (blur until hover)
                    settings.hideSpoilers ? "blur-sm hover:blur-none transition-all duration-200 select-none" : ""
                  }`}
                  dangerouslySetInnerHTML={{
                    __html: anime.description.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, ""),
                  }}
                />
              )}
              {anime.genres && anime.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {anime.genres.slice(0, 5).map((g) => (
                    <span key={g} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-xan-card text-muted-foreground uppercase tracking-wide">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Navigation buttons — M-10/M-16 FIX: show even when episode count is
              unknown (anime.episodes is null). The old gate `(anime?.episodes ||
              episode > 1)` was ALSO false on EP 1 of an airing show, hiding the
              whole row including the fallback Next button that could never render. */}
          {(hasNextEpisode || episode > 1) && (
            <div className="flex items-center gap-3">
              {episode > 1 && (
                <Link
                  to={`/watch/${animeId}?ep=${episode - 1}`}
                  className="btn-premium flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass border border-xan-border hover:border-xan-crimson/40 text-sm font-medium transition-all"
                >
                  <ArrowLeft className="h-4 w-4" /> Episode {episode - 1}
                </Link>
              )}
              {anime?.episodes && episode < anime.episodes && (
                <Link
                  to={`/watch/${animeId}?ep=${episode + 1}`}
                  className="btn-premium flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-crimson-dark text-white text-sm font-medium transition-all shadow-lg shadow-xan-crimson/20"
                >
                  Next Episode <SkipForward className="h-4 w-4" />
                </Link>
              )}
              {!anime?.episodes && (
                <Link
                  to={`/watch/${animeId}?ep=${episode + 1}`}
                  className="btn-premium flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-crimson-dark text-white text-sm font-medium transition-all shadow-lg shadow-xan-crimson/20"
                >
                  Next Episode <SkipForward className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}

          {/* Mobile-only: button to open the bottom-sheet episode picker
              (redesign plan §4: "Add a bottom-sheet episode picker on mobile
              within the Watch page, reusing the same component built for
              AnimeDetail"). Desktop uses the sidebar grid below. */}
          {anime && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="lg:hidden flex items-center justify-between gap-2 px-4 py-3 rounded-xl glass border border-xan-border hover:border-xan-crimson/40 text-sm font-medium text-foreground transition-all"
            >
              <span className="flex items-center gap-2">
                <List className="h-4 w-4 text-xan-crimson" />
                Browse episodes
              </span>
              <span className="text-xs text-muted-foreground">
                {anime.episodes ? `EP ${episode} / ${anime.episodes}` : `EP ${episode}`}
              </span>
            </button>
          )}
        </div>

        {/* ─── Sidebar ─── */}
        <div className="space-y-4">
          {/* Episodes panel — paginated, auto-opens to current episode's page */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Tv className="h-4 w-4 text-xan-crimson" />
                Episodes
              </h3>
              {(() => {
                const epCount = anime?.episodes ?? (anime?.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 0);
                return epCount > 0 ? (
                  <span className="text-xs text-muted-foreground">{epCount} total</span>
                ) : null;
              })()}
            </div>
            <EpisodePanel
              animeId={animeId}
              currentEpisode={episode}
              totalEpisodes={anime?.episodes ?? (anime?.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 0)}
              nextAirEp={anime?.nextAiringEpisode?.episode ?? null}
            />
          </div>

          {/* Audio mode selector — REMOVED: the Sub/Dub tabs now live in the
              ProviderSelector panel directly under the player (animex.one
              layout), which covers both desktop and mobile. */}

          {/* The old sidebar "Servers" panel was REMOVED — every resolved
              source now lives in the Sources row of the ProviderSelector
              under the player (one panel, no separate portion). */}
        </div>
      </div>

      {/* Mobile bottom-sheet episode picker (redesign plan §4).
          Reuses the same EpisodePickerSheet component as AnimeDetail. */}
      {anime && (
        <EpisodePickerSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          animeId={animeId}
          currentEpisode={episode}
          totalEpisodes={
            anime.episodes ??
            (anime.nextAiringEpisode ? anime.nextAiringEpisode.episode - 1 : 0)
          }
          nextAirEp={anime.nextAiringEpisode?.episode ?? null}
        />
      )}
    </div>
  );
}
