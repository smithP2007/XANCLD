import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import Hls from "hls.js";
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  SkipForward,
  Star,
  Tv,
} from "lucide-react";
import { fetchAnimeDetail, getTitle, type AnimeDetail } from "../lib/anilist";
import {
  findShowByAniListId,
  extractStreamUrl,
  type StreamResult,
} from "../lib/allanime";
import { useSettings, addToHistory, getHistory } from "../hooks/useSettings";

export function Watch() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const episode = parseInt(searchParams.get("ep") || "1", 10);
  const animeId = parseInt(id || "0", 10);

  const [settings] = useSettings();
  const [anime, setAnime] = useState<AnimeDetail | null>(null);
  const [stream, setStream] = useState<StreamResult | null>(null);
  const [allSources, setAllSources] = useState<StreamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Use the default mode from settings as the initial mode
  const [mode, setMode] = useState<"sub" | "dub">(settings.defaultMode);
  // Resume position from history (if any)
  const [resumeTime, setResumeTime] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!animeId) return;
    (async () => {
      setLoading(true);
      setError(null);
      setStream(null);
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
          setError("No title available to search AllAnime");
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

        // Find the show on AllAnime
        const show = await findShowByAniListId(animeId, title);
        if (!show) {
          setError("AllAnime couldn't find this anime. Try another title.");
          setLoading(false);
          return;
        }

        // Extract stream URL (this does AES decryption + HTML scraping in the browser)
        const result = await extractStreamUrl(show._id, String(episode), mode);
        if (result.sources.length === 0) {
          setError(
            `No stream sources found. Tried: ${result.failures
              .map((f) => f.source)
              .join(", ")}`,
          );
          setLoading(false);
          return;
        }

        setAllSources(result.sources);
        // Prefer direct mp4/hls sources over iframe embeds
        const directSources = result.sources.filter(
          (s) => s.type === "mp4" || s.type === "hls",
        );
        const iframeSources = result.sources.filter(
          (s) => s.type === "iframe",
        );
        const best = directSources[0] ?? iframeSources[0] ?? result.sources[0];
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
  }, [animeId, episode, mode]);

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
          <VideoPlayer
            stream={stream}
            loading={loading}
            error={error}
            title={anime ? getTitle(anime.title) : "Loading..."}
            episode={episode}
            animeId={animeId}
            coverImage={anime?.coverImage?.large}
            totalEpisodes={anime?.episodes}
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
                navigate(`/watch/${animeId}?ep=${episode + 1}`);
              }
            }}
          />

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
              {/* Genre pills */}
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

          {/* Navigation buttons (prev/next episode) */}
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

        {/* ─── Sidebar: episodes + sources + mode ─── */}
        <div className="space-y-4">
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
                      stream === s
                        ? "bg-xan-crimson/15 text-foreground border border-xan-crimson/40"
                        : "hover:bg-xan-card-hover text-muted-foreground border border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-medium">{s.sourceName}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase ${
                        s.type === "iframe" ? "bg-purple-500/20 text-purple-400" :
                        s.type === "hls" ? "bg-blue-500/20 text-blue-400" :
                        "bg-green-500/20 text-green-400"
                      }`}>
                        {s.type}
                      </span>
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

interface VideoPlayerProps {
  stream: StreamResult | null;
  loading: boolean;
  error: string | null;
  title: string;
  episode: number;
  animeId: number;
  coverImage?: string;
  totalEpisodes?: number | null;
  settings: {
    volume: number;
    playbackRate: number;
    skipIntro: boolean;
    autoplay: boolean;
  };
  resumeTime?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

function VideoPlayer({
  stream,
  loading,
  error,
  title,
  episode,
  animeId,
  totalEpisodes,
  settings,
  resumeTime,
  onProgress,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const lastHistoryWriteRef = useRef(0);
  const resumeAppliedRef = useRef(false);

  // Apply volume setting
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = settings.volume / 100;
  }, [settings.volume]);

  // Apply playback rate setting
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = settings.playbackRate;
  }, [settings.playbackRate]);

  useEffect(() => {
    if (!stream || !videoRef.current) return;

    const video = videoRef.current;
    const url = stream.url;
    resumeAppliedRef.current = false;

    // Cleanup previous
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (stream.type === "hls" && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      video.src = url;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [stream]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      setCurrent(video.currentTime);
      // Resume position if available (once)
      if (!resumeAppliedRef.current && resumeTime && resumeTime > 5 && video.duration > resumeTime) {
        try {
          video.currentTime = resumeTime;
          resumeAppliedRef.current = true;
        } catch {
          // ignore
        }
      }
      // Skip intro button: show during first 90 seconds if enabled
      if (settings.skipIntro && video.currentTime > 5 && video.currentTime < 90) {
        setShowSkipIntro(true);
      } else {
        setShowSkipIntro(false);
      }
      // Record to history (throttled to every 10 seconds)
      const now = Date.now();
      if (onProgress && now - lastHistoryWriteRef.current > 10000 && video.currentTime > 5 && video.duration > 0) {
        lastHistoryWriteRef.current = now;
        onProgress(video.currentTime, video.duration);
      }
    };
    const onDur = () => setDuration(video.duration || 0);
    const onEnded = () => {
      setPlaying(false);
      // Final history write
      if (onProgress && video.duration > 0) {
        onProgress(video.duration, video.duration);
      }
      onEnded?.();
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("durationchange", onDur);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("durationchange", onDur);
      video.removeEventListener("ended", onEnded);
    };
  }, [resumeTime, settings.skipIntro, onProgress, onEnded]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = parseFloat(e.target.value);
  }, []);

  const skipIntro = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 85; // Skip to 85 seconds (typical OP length)
    setShowSkipIntro(false);
  }, []);

  const fullscreen = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else v.requestFullscreen();
  }, []);

  if (loading) {
    return (
      <div className="aspect-video bg-black rounded-2xl flex flex-col items-center justify-center border border-xan-border relative overflow-hidden">
        {/* Animated gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-xan-crimson/10 via-transparent to-xan-violet/10 animate-pulse" />
        <div className="relative flex flex-col items-center">
          <div className="relative">
            <div className="absolute inset-0 bg-xan-crimson/30 blur-xl rounded-full animate-pulse" />
            <Loader2 className="relative h-12 w-12 animate-spin text-xan-crimson" />
          </div>
          <p className="text-sm text-white/80 mt-4 font-medium">
            Loading episode {episode}…
          </p>
          <p className="text-xs text-white/40 mt-1">
            AES decryption + scraping in browser
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="aspect-video bg-black rounded-2xl flex flex-col items-center justify-center border border-xan-border p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-xan-crimson/5 to-transparent" />
        <div className="relative">
          <AlertCircle className="h-12 w-12 text-xan-crimson mb-3 mx-auto" />
          <p className="font-semibold text-foreground text-lg">Stream Unavailable</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">{error}</p>
        </div>
      </div>
    );
  }

  if (!stream) return null;

  // Iframe embed sources (ok.ru, mp4upload, streamwish, etc.)
  // Render an <iframe> — the embed page's own JS player handles playback.
  // No sandbox: embed players need full permissions to run their DRM/ads/players.
  if (stream.type === "iframe") {
    return (
      <div className="aspect-video bg-black rounded-xl overflow-hidden border border-xan-border">
        <iframe
          src={stream.url}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-xan-border group">
      <video
        ref={videoRef}
        className="w-full h-full"
        poster=""
        playsInline
        onClick={togglePlay}
      />

      {/* Skip Intro button */}
      {showSkipIntro && (
        <button
          onClick={skipIntro}
          className="btn-premium absolute bottom-20 right-4 px-4 py-2 rounded-lg bg-xan-crimson/90 backdrop-blur text-white text-sm font-medium shadow-lg flex items-center gap-1.5 animate-fade-in"
        >
          <SkipForward className="h-4 w-4" /> Skip Intro
        </button>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={current}
          onChange={seek}
          className="w-full h-1 rounded-full appearance-none bg-white/20 cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-xan-crimson"
          style={{
            background: `linear-gradient(to right, #ef4444 ${pct}%, #52525b ${pct}%)`,
          }}
        />
        <div className="flex items-center gap-3 mt-2">
          <button onClick={togglePlay} className="text-white hover:text-xan-crimson">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button onClick={toggleMute} className="text-white hover:text-xan-crimson">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </button>
          <span className="text-xs text-white/80">
            {fmt(current)} / {fmt(duration)}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-xs px-2 py-0.5 rounded bg-white/20 text-white/90">
              {stream.sourceName}
            </span>
            <button onClick={fullscreen} className="text-white hover:text-xan-crimson">
              <Maximize className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Title overlay */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-sm text-white font-medium">
          {title} — Episode {episode}
        </p>
      </div>
    </div>
  );
}

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
