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
  Settings,
  AlertCircle,
  Sun,
  Eye,
  EyeOff,
  Check,
  ChevronRight,
  ChevronLeft,
  RotateCw,
  RotateCcw,
  Keyboard,
  X,
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
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"main" | "speed" | "quality">("main");
  const [cursorVisible, setCursorVisible] = useState(true);
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
    setCursorVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (playing) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        setCursorVisible(false);
      }, 3000);
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

  const controlsHidden = !showControls && !showSettings && !showShortcuts;
  const controlsClass = `xan-controls ${controlsHidden ? "xan-controls--hidden" : ""}`;

  return (
    <div
      ref={containerRef}
      className={`relative aspect-video bg-black rounded-lg overflow-hidden border border-xan-border group select-none ${cursorVisible ? "" : "cursor-none"}`}
      onMouseMove={showControlsTemporarily}
      onMouseLeave={() => playing && setShowControls(false)}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        style={enhancer.active ? {
          filter: enhancer.filterCss,
          willChange: "filter",
          transform: "translateZ(0)",
          backfaceVisibility: "hidden",
        } : undefined}
        playsInline
        onClick={handleVideoClick}
        crossOrigin="anonymous"
      />

      {/* Loading spinner — YouTube-style border spinner */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-xan-crimson animate-xan-spinner" />
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

      {/* Seek feedback overlay (J/L/arrows) */}
      {seekRipples.map((r) => (
        <div
          key={r.id}
          className={`absolute top-1/2 -translate-y-1/2 pointer-events-none z-20 ${
            r.side === "left" ? "left-1/4" : r.side === "right" ? "right-1/4" : "left-1/2 -translate-x-1/2"
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
            left: r.x - 40, top: r.y - 40, width: 80, height: 80,
            borderRadius: r.side === "left" ? "80px 0 0 80px" : "0 80px 80px 0",
            background: r.side === "left"
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

      {/* Skip Intro button */}
      {showSkipIntro && !loading && !error && (
        <button
          onClick={skipIntro}
          className="absolute bottom-24 right-4 z-20 px-4 py-2 rounded-lg bg-xan-crimson/90 backdrop-blur text-white text-sm font-medium shadow-lg flex items-center gap-1.5 animate-fade-in"
        >
          <ChevronRight className="h-4 w-4" />
          <ChevronRight className="h-4 w-4 -ml-3" />
          Skip Intro
        </button>
      )}

      {/* ── Top gradient with title + badges ── */}
      <div
        className={`absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-4 pt-3 pb-8 ${controlsClass}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm md:text-base truncate drop-shadow">
              {title} — Episode {episode}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 text-white font-medium">
                {stream.sourceName}
              </span>
              {enhancerActive && (
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/30">
                  ENHANCED
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Eye toggle */}
            <button
              onClick={enhancer.toggleEnabled}
              className="relative p-1.5 rounded-md hover:bg-white/15 transition-colors flex items-center justify-center"
              aria-label={enhancer.state.enabled ? "Turn enhancer off" : "Turn enhancer on"}
              title={enhancer.state.enabled ? "Enhancer ON — click to turn off (E)" : "Enhancer OFF — click to turn on (E)"}
            >
              <div className="relative w-4 h-4">
                <Eye className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${enhancer.state.enabled ? "opacity-100 scale-100 text-xan-crimson" : "opacity-0 scale-50 text-white/40"}`} />
                <EyeOff className={`absolute inset-0 h-4 w-4 transition-all duration-300 ${enhancer.state.enabled ? "opacity-0 scale-50 text-white/40" : "opacity-100 scale-100 text-white/60"}`} />
              </div>
            </button>
            {/* Enhancer settings */}
            <button
              onClick={() => setShowEnhancer(true)}
              className={`p-1.5 rounded-md hover:bg-white/15 transition-colors ${enhancerActive ? "text-xan-crimson" : "text-white"}`}
              title="Video enhancer settings (E)"
              aria-label="Video enhancer settings"
            >
              <Sun className="h-4 w-4" />
            </button>
            {/* Keyboard shortcuts */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="p-1.5 rounded-md text-white hover:bg-white/15 transition-colors"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Big center play button (when paused + controls visible) ── */}
      {!playing && !loading && !error && !autoPlayNext && showControls && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <button
            onClick={togglePlay}
            className="pointer-events-auto"
            aria-label="Play"
          >
            <div className="w-11 h-11 sm:w-20 sm:h-20 rounded-full bg-xan-crimson/90 hover:bg-xan-crimson flex items-center justify-center shadow-xl transition-transform hover:scale-105 animate-play-pop">
              <Play className="h-5 w-5 sm:h-9 sm:w-9 text-white fill-white ml-0.5 sm:ml-1" />
            </div>
          </button>
        </div>
      )}

      {/* ── Bottom controls bar ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2 sm:px-3 pb-1.5 sm:pb-2 pt-10 ${controlsClass}`}
      >
        {/* Seekbar */}
        <div
          className="relative h-3 flex items-center cursor-pointer group/seek mb-1"
          onMouseMove={handleSeekHover}
          onMouseLeave={() => setHoverPct(null)}
          onClick={handleSeekClick}
        >
          {/* Track background */}
          <div className="absolute left-0 right-0 h-1 rounded-full bg-white/25 group-hover/seek:h-1.5 transition-all" />
          {/* Buffered range */}
          <div
            className="absolute left-0 h-1 rounded-full bg-white/40 group-hover/seek:h-1.5 transition-all"
            style={{ width: `${bufferedPct}%` }}
          />
          {/* Played (crimson) */}
          <div
            className="absolute left-0 h-1 rounded-full bg-xan-crimson group-hover/seek:h-1.5 transition-all"
            style={{ width: `${pct}%` }}
          />
          {/* Skip intro marker */}
          {settings.skipIntro && duration > 90 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/70 rounded-full pointer-events-none"
              style={{ left: `${(85 / duration) * 100}%` }}
              title="Intro"
            />
          )}
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-xan-crimson shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity pointer-events-none"
            style={{ left: `${pct}%` }}
          />
          {/* Hover tooltip */}
          {hoverPct != null && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 text-white text-[11px] font-mono pointer-events-none whitespace-nowrap shadow-lg"
              style={{ left: `${hoverPct}%` }}
            >
              {fmt(hoverTime)}
            </div>
          )}
        </div>

        {/* Buttons row */}
        <div className="flex items-center justify-between text-white gap-1 flex-wrap min-h-[28px]">
          {/* Left cluster */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 rounded hover:bg-white/15 transition-colors flex-shrink-0"
              aria-label={playing ? "Pause" : "Play"}
              title={playing ? "Pause (k)" : "Play (k)"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
            </button>

            {/* Prev/Next (if available) */}
            {onPrev && (
              <button
                onClick={onPrev}
                className="p-1.5 rounded hover:bg-white/15 transition-colors flex-shrink-0 hidden sm:block"
                aria-label="Previous episode"
                title="Previous (P)"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                className="p-1.5 rounded hover:bg-white/15 transition-colors flex-shrink-0 hidden sm:block"
                aria-label="Next episode"
                title="Next (N)"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            )}

            {/* Volume — tap to expand slider (YouTube-style) */}
            <div className="flex items-center flex-shrink-0">
              <button
                onClick={() => setShowVolumeSlider((v) => !v)}
                className="p-1.5 rounded hover:bg-white/15 transition-colors"
                aria-label={muted ? "Unmute" : "Mute"}
                title={muted ? "Unmute (M)" : "Mute (M)"}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-5 w-5" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ease-out ${showVolumeSlider ? "w-14 opacity-100" : "w-0 opacity-0"}`}
              >
                <div className="relative h-3 flex items-center px-1">
                  <div className="absolute left-1 right-1 h-1 rounded-full bg-white/25" />
                  <div
                    className="absolute left-1 h-1 rounded-full bg-white transition-all"
                    style={{ width: `calc(${(muted ? 0 : volume) * 100}% * 0.85)` }}
                  />
                  <input
                    type="range" min={0} max={1} step={0.02}
                    value={muted ? 0 : volume}
                    onChange={(e) => changeVolume(Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    aria-label="Volume"
                    style={{ WebkitAppearance: "none", appearance: "none", background: "transparent" }}
                  />
                </div>
              </div>
            </div>

            {/* Time display */}
            <button
              onClick={() => setTimeMode((m) => (m === "duration" ? "remaining" : "duration"))}
              className="text-xs font-mono px-1 py-0.5 rounded hover:bg-white/15 transition-colors whitespace-nowrap flex-shrink-0 hidden sm:block"
              title="Click to toggle remaining time"
            >
              {timeMode === "duration"
                ? `${fmt(current)} / ${fmt(duration)}`
                : `${fmt(current)} / -${fmt(remainingTime)}`}
            </button>
          </div>

          {/* Right cluster */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {/* Settings (gear) — multi-level menu */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => { setShowSettings((v) => !v); setSettingsTab("main"); }}
                className={`p-1.5 rounded hover:bg-white/15 transition-colors ${showSettings ? "bg-white/15" : ""}`}
                aria-label="Settings"
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded hover:bg-white/15 transition-colors flex-shrink-0"
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            >
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Settings panel (responsive multi-level) ── */}
      {showSettings && (
        <div
          className="absolute bottom-0 left-0 right-0 max-h-[36vh] text-[12px] sm:bottom-14 sm:left-auto sm:right-3 sm:w-64 sm:max-h-[60vh] sm:text-sm z-50 rounded-t-lg sm:rounded-lg bg-[#0f0f0f]/95 backdrop-blur border-t sm:border border-white/10 shadow-2xl text-white overflow-y-auto overflow-x-hidden animate-panel-up pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile drag handle */}
          <div className="sm:hidden flex justify-center pt-1 pb-0.5 flex-shrink-0">
            <div className="w-7 h-0.5 rounded-full bg-white/30" />
          </div>

          {settingsTab === "main" && (
            <>
              <div className="sm:hidden flex items-center justify-between px-3 py-1 border-b border-white/5 flex-shrink-0">
                <span className="font-medium">Settings</span>
                <button onClick={() => setShowSettings(false)} className="p-1 rounded hover:bg-white/10">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => setSettingsTab("speed")}
                className="flex items-center justify-between w-full px-3 sm:px-4 py-1.5 sm:py-2.5 hover:bg-white/10 transition-colors"
              >
                <span>Playback speed</span>
                <span className="flex items-center gap-1.5 text-white/70">
                  {Number.isInteger(playbackRate) ? playbackRate : playbackRate.toFixed(2)}x
                  <ChevronRight className="h-4 w-4" />
                </span>
              </button>
              {qualityLevels.length > 0 && (
                <button
                  onClick={() => setSettingsTab("quality")}
                  className="flex items-center justify-between w-full px-3 sm:px-4 py-1.5 sm:py-2.5 hover:bg-white/10 transition-colors border-t border-white/5"
                >
                  <span>Quality</span>
                  <span className="flex items-center gap-1.5 text-white/70">
                    {currentQuality === -1 ? "Auto" : `${qualityLevels.find(q => q.index === currentQuality)?.height}p`}
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              )}
              <button
                onClick={() => { setShowSettings(false); setShowShortcuts(true); }}
                className="flex items-center justify-between w-full px-3 sm:px-4 py-1.5 sm:py-2.5 hover:bg-white/10 transition-colors border-t border-white/5"
              >
                <span>Keyboard shortcuts</span>
                <ChevronRight className="h-4 w-4 text-white/70" />
              </button>
            </>
          )}

          {settingsTab === "speed" && (
            <div>
              <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2.5 border-b border-white/5">
                <button onClick={() => setSettingsTab("main")} className="p-1 rounded hover:bg-white/10">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-medium flex-1">Playback speed</span>
                <button onClick={() => setShowSettings(false)} className="sm:hidden p-1 rounded hover:bg-white/10">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Speed slider */}
              <div className="px-3 sm:px-4 py-1.5 sm:py-3 border-b border-white/5">
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-xs text-white/60">Speed</span>
                  <span className="text-xs font-mono font-bold text-xan-crimson">
                    {Number.isInteger(playbackRate) ? `${playbackRate}.00` : playbackRate.toFixed(2)}x
                  </span>
                </div>
                <div className="relative h-4 flex items-center">
                  <div className="absolute left-0 right-0 h-1 rounded-full bg-white/25" />
                  <div
                    className="absolute left-0 h-1 rounded-full bg-xan-crimson transition-all"
                    style={{ width: `${((playbackRate - 0.25) / (4 - 0.25)) * 100}%` }}
                  />
                  <div
                    className="absolute w-2.5 h-2.5 rounded-full bg-white shadow-sm pointer-events-none"
                    style={{ left: `calc(${((playbackRate - 0.25) / (4 - 0.25)) * 100}% - 5px)` }}
                  />
                  <input
                    type="range" min={0.25} max={4} step={0.05}
                    value={playbackRate}
                    onChange={(e) => changePlaybackRate(Number(e.target.value))}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer"
                    style={{ WebkitAppearance: "none", appearance: "none", background: "transparent" }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-white/30 mt-1 px-0.5">
                  <span>0.25x</span><span>1x</span><span>2x</span><span>4x</span>
                </div>
              </div>
              {/* Preset speeds */}
              <div className="max-h-[130px] overflow-y-auto">
                {[0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changePlaybackRate(rate)}
                    className="flex items-center justify-between w-full px-3 sm:px-4 py-1 sm:py-2 hover:bg-white/10 transition-colors"
                  >
                    <span>{rate}x{rate === 1 ? " (Normal)" : ""}</span>
                    {rate === playbackRate && <Check className="h-4 w-4 text-xan-crimson" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {settingsTab === "quality" && (
            <div>
              <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2.5 border-b border-white/5">
                <button onClick={() => setSettingsTab("main")} className="p-1 rounded hover:bg-white/10">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-medium flex-1">Quality</span>
                <button onClick={() => setShowSettings(false)} className="sm:hidden p-1 rounded hover:bg-white/10">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <button
                onClick={() => { changeQuality(-1); setSettingsTab("main"); }}
                className="flex items-center justify-between w-full px-3 sm:px-4 py-1 sm:py-2 hover:bg-white/10 transition-colors"
              >
                <span>Auto{currentQuality === -1 ? " (current)" : ""}</span>
                {currentQuality === -1 && <Check className="h-4 w-4 text-xan-crimson" />}
              </button>
              {qualityLevels.map((lvl) => (
                <button
                  key={lvl.index}
                  onClick={() => { changeQuality(lvl.index); setSettingsTab("main"); }}
                  className="flex items-center justify-between w-full px-3 sm:px-4 py-1 sm:py-2 hover:bg-white/10 transition-colors"
                >
                  <span>{lvl.height}p</span>
                  {currentQuality === lvl.index && <Check className="h-4 w-4 text-xan-crimson" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overlays */}
      <KeyboardShortcutsOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <VideoEnhancerPanel open={showEnhancer} onClose={() => setShowEnhancer(false)} />
      <AutoPlayOverlay
        open={autoPlayNext}
        onCancel={() => onAutoPlayCancel?.()}
        onPlayNow={() => { onAutoPlayCancel?.(); onNext?.(); }}
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
