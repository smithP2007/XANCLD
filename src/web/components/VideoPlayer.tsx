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
} from "lucide-react";
import type { StreamResult } from "../lib/allanime";
import type { XanSettings } from "../hooks/useSettings";

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
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHistoryWriteRef = useRef(0);
  const resumeAppliedRef = useRef(false);

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

  // ─── Load stream ───
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const url = stream.url;
    resumeAppliedRef.current = false;
    setLoading(true);
    setError(null);

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
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = hls.levels
          .map((l, i) => ({ height: l.height, index: i }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.height - a.height);
        setQualityLevels(levels);
        setLoading(false);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setCurrentQuality(data.level);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          setError(`Playback error: ${data.details}`);
          setLoading(false);
        }
      });
    } else if (stream.type === "mp4") {
      // Route MP4 through streaming proxy for CORS + Referer
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
      // Resume position
      if (!resumeAppliedRef.current && resumeTime && resumeTime > 5 && video.duration > resumeTime) {
        try {
          video.currentTime = resumeTime;
          resumeAppliedRef.current = true;
        } catch { /* ignore */ }
      }
    };
    const onTime = () => {
      setCurrent(video.currentTime);
      // Skip intro button
      if (settings.skipIntro && video.currentTime > 5 && video.currentTime < 90) {
        setShowSkipIntro(true);
      } else {
        setShowSkipIntro(false);
      }
      // Buffered
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
      // History (throttled)
      const now = Date.now();
      if (onProgress && now - lastHistoryWriteRef.current > 10000 && video.currentTime > 5 && video.duration > 0) {
        lastHistoryWriteRef.current = now;
        onProgress(video.currentTime, video.duration);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      if (onProgress && video.duration > 0) onProgress(video.duration, video.duration);
      onEnded?.();
    };
    const onError = () => {
      setError("Failed to load video. The source may be unavailable.");
      setLoading(false);
    };
    const onVolumeChange = () => {
      setMuted(video.muted);
      setVolume(video.volume);
    };

    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    video.addEventListener("volumechange", onVolumeChange);

    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      video.removeEventListener("volumechange", onVolumeChange);
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

  // ─── Keyboard shortcuts ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime -= 10;
          break;
        case "ArrowRight":
          e.preventDefault();
          if (videoRef.current) videoRef.current.currentTime += 10;
          break;
        case "ArrowUp":
          e.preventDefault();
          if (videoRef.current) videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1);
          break;
        case "ArrowDown":
          e.preventDefault();
          if (videoRef.current) videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1);
          break;
        case "m":
          toggleMute();
          break;
        case "f":
          toggleFullscreen();
          break;
      }
      showControlsTemporarily();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, toggleMute, toggleFullscreen, showControlsTemporarily]);

  const pct = duration > 0 ? (current / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

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
        playsInline
        onClick={togglePlay}
        crossOrigin="anonymous"
      />

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
      {!playing && !loading && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center z-10"
        >
          <div className="w-20 h-20 rounded-full bg-xan-crimson/90 backdrop-blur flex items-center justify-center pulse-glow hover:scale-110 transition-transform">
            <Play className="h-10 w-10 text-white fill-white ml-1" />
          </div>
        </button>
      )}

      {/* Title overlay (top) */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 z-10 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <p className="text-sm text-white font-medium line-clamp-1">{title} — Episode {episode}</p>
        <p className="text-xs text-white/50">{stream.sourceName}</p>
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 z-10 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Progress bar */}
        <div className="px-4 pt-8 pb-1">
          <div className="relative group/progress h-1.5 rounded-full bg-white/20 cursor-pointer">
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
            {/* Hover thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
              style={{ left: `${pct}%` }}
            />
            {/* Click-to-seek */}
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={current}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-3 px-4 pb-3 pt-1">
          {/* Prev */}
          {onPrev && (
            <button onClick={onPrev} className="text-white/80 hover:text-xan-crimson transition-colors" title="Previous">
              <SkipBack className="h-5 w-5" />
            </button>
          )}
          {/* Play/Pause */}
          <button onClick={togglePlay} className="text-white hover:text-xan-crimson transition-colors">
            {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>
          {/* Next */}
          {onNext && (
            <button onClick={onNext} className="text-white/80 hover:text-xan-crimson transition-colors" title="Next">
              <SkipForward className="h-5 w-5" />
            </button>
          )}
          {/* Volume */}
          <div className="flex items-center gap-2 group/vol">
            <button onClick={toggleMute} className="text-white hover:text-xan-crimson transition-colors">
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> :
               volume < 0.5 ? <Volume1 className="h-5 w-5" /> :
               <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(parseFloat(e.target.value))}
              className="w-0 group-hover/vol:w-20 h-1 rounded-full appearance-none bg-white/30 cursor-pointer transition-all duration-300
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>
          {/* Time */}
          <span className="text-xs text-white/80 font-mono">
            {fmt(current)} / {fmt(duration)}
          </span>
          {/* Right side */}
          <div className="ml-auto flex items-center gap-3">
            {/* Settings (quality + speed) */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className={`text-white transition-colors ${showSettings ? "text-xan-crimson" : "hover:text-xan-crimson"}`}
              >
                <Settings className="h-5 w-5" />
              </button>
              {showSettings && (
                <div className="absolute bottom-10 right-0 w-48 glass-strong rounded-xl p-2 space-y-2 animate-scale-in">
                  {/* Playback speed */}
                  <div>
                    <p className="text-[10px] text-white/50 uppercase tracking-wide px-2 mb-1">Speed</p>
                    <div className="grid grid-cols-3 gap-1">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                        <button
                          key={r}
                          onClick={() => changePlaybackRate(r)}
                          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                            playbackRate === r ? "bg-xan-crimson text-white" : "text-white/70 hover:bg-white/10"
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Quality (HLS only) */}
                  {qualityLevels.length > 0 && (
                    <div className="pt-2 border-t border-white/10">
                      <p className="text-[10px] text-white/50 uppercase tracking-wide px-2 mb-1">Quality</p>
                      <div className="space-y-0.5">
                        <button
                          onClick={() => changeQuality(-1)}
                          className={`block w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                            currentQuality === -1 ? "bg-xan-crimson text-white" : "text-white/70 hover:bg-white/10"
                          }`}
                        >
                          Auto
                        </button>
                        {qualityLevels.map((q) => (
                          <button
                            key={q.index}
                            onClick={() => changeQuality(q.index)}
                            className={`block w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                              currentQuality === q.index ? "bg-xan-crimson text-white" : "text-white/70 hover:bg-white/10"
                            }`}
                          >
                            {q.height}p
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="text-white hover:text-xan-crimson transition-colors">
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
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
