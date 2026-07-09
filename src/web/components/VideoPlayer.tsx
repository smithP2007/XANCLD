import { useRef, useEffect, useState, useCallback } from "react";
import Hls from "hls.js";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  SkipForward,
  SkipBack,
  Settings,
  Loader2,
  AlertCircle,
  Sun,
  Eye,
  EyeOff,
} from "lucide-react";
import type { StreamResult } from "../lib/allanime";
import type { XanSettings } from "../hooks/useSettings";
import { KeyboardShortcutsOverlay } from "./KeyboardShortcutsOverlay";
import { AutoPlayOverlay } from "./AutoPlayOverlay";
import { VideoEnhancerPanel } from "./VideoEnhancerPanel";
import { useVideoEnhancer } from "../hooks/useVideoEnhancer";

interface VideoPlayerProps {
  stream: StreamResult;
  title: string;
  episode: number;
  settings: XanSettings;
  resumeTime?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  /** When true, show the auto-play next-episode overlay (controlled by parent) */
  autoPlayNext?: boolean;
  /** Called when user cancels auto-play countdown */
  onAutoPlayCancel?: () => void;
  nextEpisodeLabel?: string;
}

interface SeekRipple {
  id: number;
  side: "left" | "right" | "center";
  amount: string; // "+10s" / "-10s"
}

interface TapRipple {
  id: number;
  side: "left" | "right";
  x: number;
  y: number;
}

export function VideoPlayer({
  stream,
  title,
  episode,
  settings,
  resumeTime,
  onProgress,
  onEnded,
  onNext,
  onPrev,
  autoPlayNext = false,
  onAutoPlayCancel,
  nextEpisodeLabel,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHistoryWriteRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const lastTapRef = useRef(0);
  const lastTapSideRef = useRef<"left" | "right" | null>(null);

  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(settings.volume / 100);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(settings.playbackRate);
  const [showSettings, setShowSettings] = useState(false);
  const [qualityLevels, setQualityLevels] = useState<{ height: number; index: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [timeMode, setTimeMode] = useState<"duration" | "remaining">("duration");
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [seekRipples, setSeekRipples] = useState<SeekRipple[]>([]);
  const [tapRipples, setTapRipples] = useState<TapRipple[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showEnhancer, setShowEnhancer] = useState(false);
  const enhancer = useVideoEnhancer();

  // ─── Load stream ───
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const url = stream.url;
    resumeAppliedRef.current = false;
    setLoading(true);
    setError(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (stream.type === "hls" && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels
          .map((l, i) => ({ height: l.height, index: i }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.height - a.height);
        setQualityLevels(levels);
        setLoading(false);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentQuality(data.level));
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError(`Playback error: ${data.details}`);
          setLoading(false);
        }
      });
    } else if (stream.type === "mp4") {
      const proxyUrl = `/api/stream?url=${encodeURIComponent(url)}`;
      video.src = proxyUrl;
      video.load();
    } else {
      video.src = url;
      video.load();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [stream]);

  // ─── Apply settings ───
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = settings.volume / 100;
      setVolume(settings.volume / 100);
    }
  }, [settings.volume]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = settings.playbackRate;
      setPlaybackRate(settings.playbackRate);
    }
  }, [settings.playbackRate]);

  // ─── Video event listeners ───
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => { setPlaying(true); setLoading(false); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onLoaded = () => {
      setDuration(video.duration || 0);
      setLoading(false);
      if (!resumeAppliedRef.current && resumeTime && resumeTime > 5 && video.duration > resumeTime) {
        try {
          video.currentTime = resumeTime;
          resumeAppliedRef.current = true;
        } catch { /* ignore */ }
      }
    };
    const onTime = () => {
      setCurrent(video.currentTime);
      if (settings.skipIntro && video.currentTime > 5 && video.currentTime < 90) {
        setShowSkipIntro(true);
      } else {
        setShowSkipIntro(false);
      }
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
      const now = Date.now();
      if (onProgress && now - lastHistoryWriteRef.current > 10000 && video.currentTime > 5 && video.duration > 0) {
        lastHistoryWriteRef.current = now;
        onProgress(video.currentTime, video.duration);
      }
    };
    const onEndedEvt = () => {
      setPlaying(false);
      if (onProgress && video.duration > 0) onProgress(video.duration, video.duration);
      onEnded?.();
    };
    const onError = () => {
      setError("Failed to load video. The source may be unavailable.");
      setLoading(false);
    };
    const onVolumeChangeEvt = () => {
      setMuted(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEndedEvt);
    video.addEventListener("error", onError);
    video.addEventListener("volumechange", onVolumeChangeEvt);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEndedEvt);
      video.removeEventListener("error", onError);
      video.removeEventListener("volumechange", onVolumeChangeEvt);
    };
  }, [resumeTime, settings.skipIntro, onProgress, onEnded]);

  // ─── Fullscreen ───
  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ─── Controls auto-hide ───
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    } else {
      showControlsTemporarily();
    }
  }, [playing, showControlsTemporarily]);

  // ─── Seek ripple helper ───
  const fireSeekRipple = useCallback((amount: string, side: SeekRipple["side"]) => {
    const id = Date.now() + Math.random();
    setSeekRipples((r) => [...r, { id, side, amount }]);
    setTimeout(() => {
      setSeekRipples((r) => r.filter((x) => x.id !== id));
    }, 700);
  }, []);

  const fireTapRipple = useCallback((side: "left" | "right", x: number, y: number) => {
    const id = Date.now() + Math.random();
    setTapRipples((r) => [...r, { id, side, x, y }]);
    setTimeout(() => {
      setTapRipples((r) => r.filter((x) => x.id !== id));
    }, 550);
  }, []);

  // ─── Controls ───
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
  }, []);

  const changeVolume = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  }, []);

  const seek = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = val;
    setCurrent(val);
  }, []);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      const next = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
      v.currentTime = next;
      setCurrent(next);
      fireSeekRipple(`${delta > 0 ? "+" : ""}${delta}s`, delta > 0 ? "right" : "left");
    },
    [fireSeekRipple],
  );

  const skipIntro = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 85;
    setShowSkipIntro(false);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }, []);

  const changePlaybackRate = useCallback((rate: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  const changeQuality = useCallback((index: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
      setCurrentQuality(index);
    }
  }, []);

  // ─── Mobile double-tap to seek ───
  const handleVideoClick = useCallback(
    (e: React.MouseEvent<HTMLVideoElement>) => {
      const v = videoRef.current;
      if (!v) return;
      const rect = v.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const side: "left" | "right" = x < rect.width / 2 ? "left" : "right";
      const now = Date.now();
      const sinceLast = now - lastTapRef.current;
      if (sinceLast < 300 && lastTapSideRef.current === side) {
        // Double tap → seek ±10
        fireTapRipple(side, x, e.clientY - rect.top);
        seekBy(side === "left" ? -10 : 10);
        lastTapRef.current = 0;
      } else {
        // Single tap → toggle play (after small delay so double-tap can override)
        lastTapRef.current = now;
        lastTapSideRef.current = side;
        setTimeout(() => {
          if (lastTapRef.current === now) {
            togglePlay();
          }
        }, 250);
      }
    },
    [fireTapRipple, seekBy, togglePlay],
  );

  // ─── Keyboard shortcuts (extended) ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      // 0–9 → seek to N×10%
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const v = videoRef.current;
        if (!v || !v.duration) return;
        const pct = parseInt(e.key, 10) * 0.1;
        v.currentTime = v.duration * pct;
        fireSeekRipple(`${pct * 100}%`, "center");
        showControlsTemporarily();
        return;
      }

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "j":
          e.preventDefault();
          seekBy(-10);
          break;
        case "l":
          e.preventDefault();
          seekBy(10);
          break;
        case "ArrowLeft":
          e.preventDefault();
          seekBy(-5);
          break;
        case "ArrowRight":
          e.preventDefault();
          seekBy(5);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (videoRef.current)
            videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          if (videoRef.current)
            videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
        case "n":
          onNext?.();
          break;
        case "p":
          onPrev?.();
          break;
        case "e":
          e.preventDefault();
          enhancer.toggleEnabled();
          setShowEnhancer((v) => !v);
          break;
        case "?":
          e.preventDefault();
          setShowShortcuts((v) => !v);
          break;
      }
      showControlsTemporarily();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    togglePlay,
    toggleMute,
    toggleFullscreen,
    seekBy,
    onNext,
    onPrev,
    showControlsTemporarily,
    fireSeekRipple,
  ]);

  // ─── Hover tooltip on seekbar ───
  const handleSeekHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    setHoverPct(Math.max(0, Math.min(100, pct)));
  };

  const hoverTime = hoverPct != null && duration > 0 ? (hoverPct / 100) * duration : 0;

  // ─── Click-to-seek on seekbar ───
  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    seek(pct * duration);
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const remainingTime = duration > 0 ? duration - current : 0;
  const enhancerActive = enhancer.active;

  return (
    <div
      ref={containerRef}
      className="relative aspect-video bg-black rounded-2xl overflow-hidden border border-xan-border group select-none"
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full"
        style={enhancer.active ? {
          filter: enhancer.filterCss,
          willChange: "filter",
          // Force GPU compositing layer so the filter runs on the GPU, not CPU
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        } : undefined}
        playsInline
        onClick={handleVideoClick}
        crossOrigin="anonymous"
      />

      {/* Seek ripples (J/L/arrows/0-9 feedback) */}
      {seekRipples.map((r) => (
        <div
          key={r.id}
          className={`absolute top-1/2 -translate-y-1/2 pointer-events-none z-20 ${
            r.side === "left"
              ? "left-1/4"
              : r.side === "right"
                ? "right-1/4"
                : "left-1/2 -translate-x-1/2"
          }`}
        >
          <div className="animate-seek-ripple text-4xl font-bold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            {r.amount}
          </div>
        </div>
      ))}

      {/* Mobile tap ripples */}
      {tapRipples.map((r) => (
        <div
          key={r.id}
          className="absolute pointer-events-none z-20"
          style={{
            left: r.x - 40,
            top: r.y - 40,
            width: 80,
            height: 80,
            borderRadius: r.side === "left" ? "80px 0 0 80px" : "0 80px 80px 0",
            background:
              r.side === "left"
                ? "radial-gradient(circle at 100% 50%, rgba(233,69,96,0.6), transparent 70%)"
                : "radial-gradient(circle at 0% 50%, rgba(233,69,96,0.6), transparent 70%)",
          }}
        >
          <div className="animate-tap-ripple w-full h-full flex items-center justify-center">
            <span className="text-2xl font-bold text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
              {r.side === "left" ? "-10s" : "+10s"}
            </span>
          </div>
        </div>
      ))}

      {/* Loading overlay */}
      {loading && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-20">
          <div className="relative">
            <div className="absolute inset-0 bg-xan-crimson/40 blur-xl rounded-full animate-pulse" />
            <Loader2 className="relative h-12 w-12 animate-spin text-xan-crimson" />
          </div>
          <p className="text-sm text-white/80 mt-4 font-medium">Loading…</p>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-30 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-xan-crimson mb-3" />
          <p className="font-semibold text-white text-lg">Playback Error</p>
          <p className="text-sm text-white/60 mt-1 max-w-md">{error}</p>
        </div>
      )}

      {/* Skip Intro button */}
      {showSkipIntro && !loading && !error && (
        <button
          onClick={skipIntro}
          className="btn-premium absolute bottom-24 right-4 z-20 px-4 py-2 rounded-lg bg-xan-crimson/90 backdrop-blur text-white text-sm font-medium shadow-lg flex items-center gap-1.5 animate-fade-in"
        >
          <SkipForward className="h-4 w-4" /> Skip Intro
        </button>
      )}

      {/* Center play button (when paused) */}
      {!playing && !loading && !error && !autoPlayNext && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
          aria-label="Play"
        >
          <div className="w-20 h-20 rounded-full bg-xan-crimson/90 backdrop-blur flex items-center justify-center pulse-glow hover:scale-110 transition-transform animate-play-pop">
            <Play className="h-10 w-10 text-white fill-white ml-1" />
          </div>
        </button>
      )}

      {/* Title overlay (top) */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-10 xan-controls ${
          showControls ? "" : "xan-controls--hidden"
        }`}
      >
        <p className="text-sm text-white font-medium line-clamp-1">
          {title} — Episode {episode}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-xs text-white/50">{stream.sourceName}</p>
          {enhancerActive && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/30">
              ENHANCED
            </span>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-10 xan-controls ${
          showControls ? "" : "xan-controls--hidden"
        }`}
      >
        {/* Progress bar */}
        <div className="px-4 pt-8 pb-1">
          <div
            className="relative group/progress h-1.5 rounded-full bg-white/20 cursor-pointer"
            onMouseMove={handleSeekHover}
            onMouseLeave={() => setHoverPct(null)}
            onClick={handleSeekClick}
          >
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/30"
              style={{ width: `${bufferedPct}%` }}
            />
            {/* Played */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-xan-crimson to-xan-violet"
              style={{ width: `${pct}%` }}
            />
            {/* Skip-intro marker notch */}
            {settings.skipIntro && duration > 90 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/40 rounded-full"
                style={{ left: `${(85 / duration) * 100}%` }}
                title="Skip intro marker"
              />
            )}
            {/* Hover thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `${pct}%` }}
            />
            {/* Hover tooltip with timestamp */}
            {hoverPct != null && (
              <div
                className="absolute -top-9 -translate-x-1/2 px-2 py-1 rounded glass-strong text-[10px] font-mono font-bold text-white whitespace-nowrap pointer-events-none"
                style={{ left: `${hoverPct}%` }}
              >
                {fmt(hoverTime)}
              </div>
            )}
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-1">
          {/* Prev */}
          {onPrev && (
            <button
              onClick={onPrev}
              className="text-white/80 hover:text-xan-crimson transition-colors"
              title="Previous (P)"
              aria-label="Previous episode"
            >
              <SkipBack className="h-5 w-5" />
            </button>
          )}
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-white hover:text-xan-crimson transition-colors"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>
          {/* Next */}
          {onNext && (
            <button
              onClick={onNext}
              className="text-white/80 hover:text-xan-crimson transition-colors"
              title="Next (N)"
              aria-label="Next episode"
            >
              <SkipForward className="h-5 w-5" />
            </button>
          )}
          {/* Volume */}
          <div className="flex items-center gap-2 group/vol">
            <button
              onClick={toggleMute}
              className="text-white hover:text-xan-crimson transition-colors"
              aria-label="Mute"
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-5 w-5" />
              ) : volume < 0.5 ? (
                <Volume1 className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              className="xan-vol w-0 group-hover/vol:w-20 transition-all duration-300"
            />
          </div>
          {/* Time (click to toggle) */}
          <button
            onClick={() => setTimeMode((m) => (m === "duration" ? "remaining" : "duration"))}
            className="text-xs text-white/80 font-mono hover:text-white transition-colors"
            title="Click to toggle current/remaining"
          >
            {timeMode === "duration"
              ? `${fmt(current)} / ${fmt(duration)}`
              : `${fmt(current)} / -${fmt(remainingTime)}`}
          </button>
          {/* Right side */}
          <div className="ml-auto flex items-center gap-3">
            {/* Eye toggle — turns enhancer on/off (only shows when enhancer is enabled) */}
            {enhancer.state.enabled && (
              <button
                onClick={enhancer.toggleEnabled}
                className={`transition-colors ${
                  enhancer.state.enabled ? "text-xan-crimson" : "text-white/60 hover:text-white"
                }`}
                title={enhancer.state.enabled ? "Enhancer ON — click to turn off" : "Enhancer OFF — click to turn on"}
                aria-label={enhancer.state.enabled ? "Turn enhancer off" : "Turn enhancer on"}
              >
                {enhancer.state.enabled ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            )}
            {/* Enhancer settings button */}
            <button
              onClick={() => setShowEnhancer(true)}
              className={`transition-colors ${
                enhancerActive ? "text-xan-crimson" : "text-white hover:text-xan-crimson"
              }`}
              title="Video enhancer settings (E)"
              aria-label="Video enhancer settings"
            >
              <Sun className="h-5 w-5" />
            </button>
            {/* Settings (quality + speed) */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`text-white transition-colors ${
                  showSettings ? "text-xan-crimson" : "hover:text-xan-crimson"
                }`}
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
              {showSettings && (
                <div className="absolute bottom-10 right-0 w-48 glass-strong rounded-xl p-2 space-y-2 animate-panel-up">
                  <div>
                    <p className="text-[10px] text-white/50 uppercase tracking-wide px-2 mb-1">Speed</p>
                    <div className="grid grid-cols-3 gap-1">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                        <button
                          key={r}
                          onClick={() => changePlaybackRate(r)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            playbackRate === r
                              ? "bg-xan-crimson text-white"
                              : "text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                  </div>
                  {qualityLevels.length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-[10px] text-white/50 uppercase tracking-wide px-2 mb-1">Quality</p>
                      <div className="space-y-0.5">
                        <button
                          onClick={() => changeQuality(-1)}
                          className={`block w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                            currentQuality === -1
                              ? "bg-xan-crimson text-white"
                              : "text-white/70 hover:bg-white/10"
                          }`}
                        >
                          Auto
                        </button>
                        {qualityLevels.map((q) => (
                          <button
                            key={q.index}
                            onClick={() => changeQuality(q.index)}
                            className={`block w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                              currentQuality === q.index
                                ? "bg-xan-crimson text-white"
                                : "text-white/70 hover:bg-white/10"
                            }`}
                          >
                            {q.height}p
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="pt-2 border-t border-white/10">
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setShowShortcuts(true);
                      }}
                      className="block w-full text-left px-2 py-1 rounded text-xs text-white/70 hover:bg-white/10 transition-colors"
                    >
                      Keyboard shortcuts (?)
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-xan-crimson transition-colors"
              aria-label="Fullscreen"
            >
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Overlays */}
      <KeyboardShortcutsOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <VideoEnhancerPanel
        open={showEnhancer}
        onClose={() => setShowEnhancer(false)}
      />
      <AutoPlayOverlay
        open={autoPlayNext}
        onCancel={() => onAutoPlayCancel?.()}
        onPlayNow={() => {
          onAutoPlayCancel?.();
          onNext?.();
        }}
        nextEpisodeLabel={nextEpisodeLabel}
      />
    </div>
  );
}

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
