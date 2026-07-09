import { useState, useEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  SkipForward,
  Star,
  Tv,
  Volume2,
  Server,
  Sun,
} from "lucide-react";
import { fetchAnimeDetail, getTitle, type AnimeDetail } from "../lib/anilist";
import {
  findShowByAniListId,
  extractStreamUrl,
  type StreamResult,
} from "../lib/allanime";
import { extractGogoStream, type GogoSource } from "../lib/gogoanime";
import { getKotoSource } from "../lib/providers/koto";
import { fetchZenSources } from "../lib/providers/zen";
import { useSettings, addToHistory, getHistory } from "../hooks/useSettings";
import { useVideoEnhancer } from "../hooks/useVideoEnhancer";
import { VideoEnhancerPanel } from "../components/VideoEnhancerPanel";
import { VideoPlayer } from "../components/VideoPlayer";

type Provider = "allanime" | "koto" | "zen" | "gogoanime";

interface UnifiedSource {
  url: string;
  type: "hls" | "mp4" | "iframe";
  quality: string | null;
  sourceName: string;
  provider: Provider;
}

export function Watch() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const episode = parseInt(searchParams.get("ep") || "1", 10);
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
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [showEnhancer, setShowEnhancer] = useState(false);
  const enhancer = useVideoEnhancer();
  const [providerStatus, setProviderStatus] = useState<Record<Provider, "idle" | "loading" | "done" | "error">>({
    allanime: "idle",
    koto: "idle",
    zen: "idle",
    gogoanime: "idle",
  });

  // Load stream from a specific provider
  const loadFromProvider = async (prov: Provider, title: string) => {
    setProviderStatus((prev) => ({ ...prev, [prov]: "loading" }));
    try {
      let sources: UnifiedSource[] = [];

      if (prov === "allanime") {
        const show = await findShowByAniListId(animeId, title);
        if (!show) {
          setProviderStatus((prev) => ({ ...prev, [prov]: "error" }));
          return [];
        }
        const result = await extractStreamUrl(show._id, String(episode), mode);
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
      } else if (prov === "gogoanime") {
        const result = await extractGogoStream(title, episode);
        sources = result.sources.map((s: GogoSource) => ({
          url: s.url,
          type: s.type,
          quality: s.quality,
          sourceName: `Gogo-${s.quality}`,
          provider: "gogoanime" as const,
        }));
      }

      setProviderStatus((prev) => ({ ...prev, [prov]: sources.length > 0 ? "done" : "error" }));
      return sources;
    } catch (err) {
      console.error(`[${prov}] failed:`, err);
      setProviderStatus((prev) => ({ ...prev, [prov]: "error" }));
      return [];
    }
  };

  useEffect(() => {
    if (!animeId) return;
    setAutoPlayNext(false);
    (async () => {
      setLoading(true);
      setError(null);
      setStream(null);
      setAllSources([]);
      setProviderStatus({ allanime: "idle", koto: "idle", zen: "idle", gogoanime: "idle" });

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

        // Check history for resume position
        const history = getHistory();
        const existing = history.find(
          (e) => e.animeId === animeId && e.episode === episode,
        );
        if (existing && existing.timestamp > 5) {
          setResumeTime(existing.timestamp);
        } else {
          setResumeTime(undefined);
        }

        // Try providers in priority order: user's preferred first, then others.
        // When dub is selected, prefer AllAnime first (it returns actual dub sources).
        // Zen/Koto have dual-audio players that default to sub (user must switch inside player).
        const allProviders: Provider[] = mode === "dub"
          ? ["allanime", "zen", "koto", "gogoanime"]
          : ["allanime", "koto", "zen", "gogoanime"];
        const orderedProviders: Provider[] = [
          provider,
          ...allProviders.filter((p) => p !== provider),
        ];

        let sources: UnifiedSource[] = [];
        for (const prov of orderedProviders) {
          const provSources = await loadFromProvider(prov, title);
          if (provSources.length > 0) {
            sources = provSources;
            console.log(`[Watch] using ${prov} (${sources.length} sources)`);
            break;
          }
        }

        // In the background, try remaining providers to populate the source picker
        for (const prov of orderedProviders) {
          if (providerStatus[prov] === "idle") {
            loadFromProvider(prov, title).then((extraSources) => {
              if (extraSources.length > 0) {
                setAllSources((prev) => {
                  const existingUrls = new Set(prev.map((s) => s.url));
                  const newOnes = extraSources.filter((s) => !existingUrls.has(s.url));
                  return [...prev, ...newOnes];
                });
              }
            });
          }
        }

        if (sources.length === 0) {
          // Last resort: demo HLS stream so the player at least shows something
          console.log("[Watch] All providers failed — adding demo stream fallback");
          sources = [{
            url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
            type: "hls" as const,
            quality: "Demo",
            sourceName: "Demo Stream",
            provider: "allanime" as const,
          }];
        }

        setAllSources(sources);
        // Prefer direct mp4/hls sources over iframe embeds
        const directSources = sources.filter((s) => s.type === "mp4" || s.type === "hls");
        const iframeSources = sources.filter((s) => s.type === "iframe");
        const best = directSources[0] ?? iframeSources[0] ?? sources[0];
        if (best) {
          setStream(best);
        } else {
          setError("No playable stream sources found");
        }
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setLoading(false);
      }
    })();
  }, [animeId, episode, mode, provider]);

  // Convert UnifiedSource to StreamResult for VideoPlayer
  const streamForPlayer = stream
    ? { url: stream.url, type: stream.type, quality: stream.quality, sourceName: stream.sourceName, provider: stream.provider }
    : null;

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
              {/* Show provider status */}
              <div className="mt-4 flex items-center gap-3 text-xs">
                {(["allanime", "gogoanime"] as const).map((p) => (
                  <div key={p} className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      providerStatus[p] === "done" ? "bg-green-500" :
                      providerStatus[p] === "error" ? "bg-red-500" :
                      providerStatus[p] === "loading" ? "bg-yellow-500 animate-pulse" :
                      "bg-zinc-600"
                    }`} />
                    <span className="text-muted-foreground">{p}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : streamForPlayer ? (
            streamForPlayer.type === "iframe" ? (
              <div className="space-y-2">
                {/* Dub hint for dual-audio iframe providers (Zen/Koto) */}
                {mode === "dub" && (streamForPlayer.provider === "zen" || streamForPlayer.provider === "koto") && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-xan-crimson/10 border border-xan-crimson/30 text-sm text-foreground">
                    <Volume2 className="h-4 w-4 text-xan-crimson flex-shrink-0" />
                    <span>
                      <strong className="text-xan-crimson">Dub selected:</strong>{" "}
                      This player has dual audio (sub + dub). Click the{" "}
                      <strong>speaker/language icon</strong> inside the player to switch to English dub.
                    </span>
                  </div>
                )}
                {/* Enhancer toggle for iframe */}
                <div className="flex items-center justify-end gap-2">
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
                </div>
                <div className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-xan-border">
                  <iframe
                    src={streamForPlayer.url}
                    className="w-full h-full"
                    style={enhancer.active ? {
                      filter: enhancer.filterCss,
                      willChange: "filter",
                      transform: "translateZ(0)",
                      backfaceVisibility: "hidden",
                    } : undefined}
                    allowFullScreen
                    allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                    referrerPolicy="no-referrer-when-downgrade"
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
                onProgress={(currentTime, duration) => {
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
                }}
                onEnded={() => {
                  if (settings.autoplay && anime?.episodes && episode < anime.episodes) {
                    setAutoPlayNext(true);
                  }
                }}
                onNext={
                  anime?.episodes && episode < anime.episodes
                    ? () => navigate(`/watch/${animeId}?ep=${episode + 1}`)
                    : undefined
                }
                onPrev={
                  episode > 1
                    ? () => navigate(`/watch/${animeId}?ep=${episode - 1}`)
                    : undefined
                }
                autoPlayNext={autoPlayNext}
                onAutoPlayCancel={() => setAutoPlayNext(false)}
                nextEpisodeLabel={
                  anime && episode < (anime.episodes ?? 0)
                    ? `${getTitle(anime.title)} — Episode ${episode + 1}`
                    : undefined
                }
              />
            )
          ) : null}

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
                  className="text-sm text-muted-foreground line-clamp-3 leading-relaxed"
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

          {/* Navigation buttons */}
          {anime?.episodes && (
            <div className="flex items-center gap-3">
              {episode > 1 && (
                <Link
                  to={`/watch/${animeId}?ep=${episode - 1}`}
                  className="btn-premium flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl glass border border-xan-border hover:border-xan-crimson/40 text-sm font-medium transition-all"
                >
                  <ArrowLeft className="h-4 w-4" /> Episode {episode - 1}
                </Link>
              )}
              {episode < anime.episodes && (
                <Link
                  to={`/watch/${animeId}?ep=${episode + 1}`}
                  className="btn-premium flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-xan-crimson to-xan-crimson-dark text-white text-sm font-medium transition-all shadow-lg shadow-xan-crimson/20"
                >
                  Next Episode <SkipForward className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}
        </div>

        {/* ─── Sidebar ─── */}
        <div className="space-y-4">
          {/* Provider selector */}
          <div className="glass rounded-2xl p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Server className="h-4 w-4 text-xan-crimson" />
              Provider
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(["allanime", "koto", "zen", "gogoanime"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold uppercase transition-all flex flex-col items-center gap-1 ${
                    provider === p
                      ? "bg-gradient-to-br from-xan-crimson to-xan-violet text-white shadow-md shadow-xan-crimson/30"
                      : "bg-xan-card-hover text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                  {providerStatus[p] !== "idle" && (
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      providerStatus[p] === "done" ? "bg-green-400" :
                      providerStatus[p] === "error" ? "bg-red-400" :
                      "bg-yellow-400 animate-pulse"
                    }`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Episodes panel */}
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Tv className="h-4 w-4 text-xan-crimson" />
                Episodes
              </h3>
              {anime?.episodes && (
                <span className="text-xs text-muted-foreground">{anime.episodes} total</span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1.5 max-h-64 overflow-y-auto pr-1">
              {(anime?.episodes ? Math.min(anime.episodes, 50) : 12) > 0 &&
                Array.from(
                  { length: anime?.episodes ? Math.min(anime.episodes, 50) : 12 },
                  (_, i) => i + 1,
                ).map((ep) => (
                  <Link
                    key={ep}
                    to={`/watch/${animeId}?ep=${ep}`}
                    className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                      ep === episode
                        ? "bg-gradient-to-br from-xan-crimson to-xan-crimson-dark text-white shadow-md shadow-xan-crimson/30"
                        : "bg-xan-card-hover text-muted-foreground hover:text-foreground hover:bg-xan-card"
                    }`}
                  >
                    {ep}
                  </Link>
                ))}
            </div>
          </div>

          {/* Audio mode selector */}
          <div className="glass rounded-2xl p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-xan-crimson" />
              Audio
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(["sub", "dub"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold uppercase transition-all ${
                    mode === m
                      ? "bg-gradient-to-br from-xan-crimson to-xan-crimson-dark text-white shadow-md shadow-xan-crimson/30"
                      : "bg-xan-card-hover text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Sources panel */}
          {allSources.length > 0 && (
            <div className="glass rounded-2xl p-4">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Play className="h-4 w-4 text-xan-crimson" />
                Sources
                <span className="text-xs text-muted-foreground font-normal">({allSources.length})</span>
              </h3>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {allSources.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setStream(s)}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                      stream?.url === s.url
                        ? "bg-xan-crimson/15 text-foreground border border-xan-crimson/40"
                        : "hover:bg-xan-card-hover text-muted-foreground border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium">{s.sourceName}</span>
                      <div className="flex items-center gap-1">
                        <span className="px-1 py-0.5 rounded text-[8px] uppercase bg-xan-card text-muted-foreground">
                          {s.provider}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase ${
                          s.type === "iframe" ? "bg-purple-500/20 text-purple-400" :
                          s.type === "hls" ? "bg-blue-500/20 text-blue-400" :
                          "bg-green-500/20 text-green-400"
                        }`}>
                          {s.type}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
