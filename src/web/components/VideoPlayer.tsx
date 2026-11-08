import { useRef, useEffect, useState, useCallback, useMemo } from "react";
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
  Check,
  ChevronRight,
  ChevronLeft,
  RotateCw,
  RotateCcw,
  Keyboard,
  X,
  Captions,
  Camera,
  PictureInPicture2,
  Cast,
  SkipForward,
} from "lucide-react";
import type { StreamResult } from "../lib/allanime";
import { updateSettings, type XanSettings } from "../hooks/useSettings";
import { KeyboardShortcutsOverlay } from "./KeyboardShortcutsOverlay";
import { AutoPlayOverlay } from "./AutoPlayOverlay";
import { VideoEnhancerPanel } from "./VideoEnhancerPanel";
import { useVideoEnhancer, ENHANCER_PRESETS } from "../hooks/useVideoEnhancer";
import {
  ANIME4K_PRESETS,
  isWebGPUAvailable,
  startAnime4k,
} from "../lib/anime4kRenderer";

/** One server row inside the player's SERVERS tab (built by Watch.tsx). */
export interface PlayerServerItem {
  url: string;
  label: string;
  type: "hls" | "mp4" | "iframe";
  /** Provider-family label — AllAnime / AnimeX / Zen / Koto / Demo. */
  group: string;
  active: boolean;
}

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
  /** L-12: called when the user clicks Retry on the playback-error overlay */
  onRetry?: () => void;
  /** Server rows for the player's SERVERS tab (animex.one parity). */
  servers?: PlayerServerItem[];
  /** Click on a server row — parent swaps the stream (no page reload). */
  onServerSelect?: (url: string) => void;
  /** True while background providers are still resolving. */
  serversLoading?: boolean;
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

// Intro window — single source of truth for the marker, the button
// visibility window AND the skip target. M-5 FIX: the visibility check used
// `currentTime < 90` while skipIntro() seeks to 85s, so the button hid on
// click and then reappeared 250ms later (85 < 90) until the 90s mark.
const INTRO_END = 85;

// Outro window — the last N seconds of an episode in which the (optional)
// "Skip Outro" button is shown. Clicking seeks to 1s before the end so the
// natural 'ended' event (and the autoplay-next chain) still fires.
const OUTRO_WINDOW = 90;

/** Feature support — computed once, module level (SSR-safe). */
const PIP_SUPPORTED =
  typeof document !== "undefined" && "pictureInPictureEnabled" in document;
const CAST_SUPPORTED =
  typeof HTMLMediaElement !== "undefined" && "remote" in HTMLMediaElement.prototype;

/** Section header inside the settings panel — tiny crimson dot + spaced caps. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 px-3 pt-3.5 pb-1.5 text-[10px] font-bold tracking-widest text-white/40 uppercase">
      <span className="w-1 h-1 rounded-full bg-xan-crimson/80 flex-shrink-0" />
      {children}
    </p>
  );
}

/** Shared row style — inset rounded hover, consistent 12px gutters. */
const MENU_ROW =
  "flex items-center justify-between gap-3 w-full rounded-[10px] px-3 py-2.5 text-[13px] text-white/85 hover:bg-white/[0.07] hover:text-white transition-colors text-left";

/** Player control-bar button — Netflix-style 36px hit target, subtle hover. */
const CTRL_BTN =
  "h-9 w-9 rounded-lg grid place-items-center flex-shrink-0 text-white transition-colors hover:bg-white/10 active:bg-white/[0.16] focus-visible:ring-2 focus-visible:ring-white/60 outline-none";

/** animex-style settings row with an iOS switch (used across the PLAYER tab). */
function SettingToggle({ label, hint, on, onChange, disabled }: {
  label: string;
  hint?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      className={`flex items-center justify-between gap-3 w-full rounded-[10px] px-3 py-2.5 text-left hover:bg-white/[0.07] transition-colors disabled:opacity-40 disabled:hover:bg-transparent`}
      disabled={disabled}
      role="switch"
      aria-checked={on}
    >
      <span className="min-w-0">
        <span className="block text-[13px] text-white/85">{label}</span>
        {hint && <span className="block text-[10px] text-white/40 leading-snug mt-0.5">{hint}</span>}
      </span>
      <span
        className={`relative flex-shrink-0 w-9 h-5 rounded-full transition-all duration-200 ${
          on ? "bg-xan-crimson shadow-[0_0_12px_rgba(233,69,96,0.45)]" : "bg-white/[0.16]"
        }`}
      >
        <span
          className={`absolute top-[2px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${on ? "left-[18px]" : "left-[2px]"}`}
        />
      </span>
    </button>
  );
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
  onRetry,
  servers,
  onServerSelect,
  serversLoading,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // BUG 8 FIX: loading watchdog. A stream that never starts (dead CDN, huge
  // queue) used to spin the loading spinner forever; the timer also leaked
  // across unmounts. Arm it on every stream load, disarm on 'playing' /
  // error / cleanup.
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHistoryWriteRef = useRef(0);
  const resumeAppliedRef = useRef(false);
  const lastTapRef = useRef(0);
  const lastTapSideRef = useRef<"left" | "right" | null>(null);
  // M-17: one-shot autoplay flag — set when a NEW stream starts loading,
  // consumed on the first loadedmetadata. Avoids force-resuming playback on
  // incidental metadata reloads (e.g. hls.js level switches) after the user
  // deliberately paused.
  const shouldAutoplayRef = useRef(false);

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
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(settings.playbackRate);
  const [showSettings, setShowSettings] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  // Floating settings panel: four persistent tabs (Quality/Subs/Player/Servers)
  // plus an in-PLAYER sub-page for the WebGPU renderer.
  const [settingsTab, setSettingsTab] = useState<"quality" | "subs" | "settings" | "servers">("settings");
  const [settingsPage, setSettingsPage] = useState<"main" | "renderer">("main");
  // Tab switches restart the panel at the top — a half-scrolled list must not
  // leak its scroll offset into the next tab's content.
  const settingsScrollRef = useRef<HTMLDivElement>(null);
  const [aspectOpen, setAspectOpen] = useState(false);
  // Soft-subtitle selection (AnimeX per-episode sources ship VTT tracks).
  // -1 = off; otherwise the index into stream.tracks.
  const [activeTrackIndex, setActiveTrackIndex] = useState(-1);
  const [cursorVisible, setCursorVisible] = useState(true);
  const [qualityLevels, setQualityLevels] = useState<{ height: number; index: number; bitrate: number }[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  // Height hls.js is ACTUALLY playing while in Auto mode — shown as
  // "Auto (1080p)" in the Quality tab like animex does.
  const [autoLevelHeight, setAutoLevelHeight] = useState(0);
  const [timeMode, setTimeMode] = useState<"duration" | "remaining">("duration");
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const [seekRipples, setSeekRipples] = useState<SeekRipple[]>([]);
  const [tapRipples, setTapRipples] = useState<TapRipple[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showEnhancer, setShowEnhancer] = useState(false);
  const enhancer = useVideoEnhancer();
  // ── WebGPU renderer (Anime4K) state ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const a4kSessionRef = useRef<{ destroy(): void } | null>(null);
  const [a4kStatus, setA4kStatus] = useState<"off" | "starting" | "on" | "error">("off");
  const [a4kError, setA4kError] = useState<string | null>(null);
  const [videoRes, setVideoRes] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  // ── Audio boost (Web Audio gain > 100 %) ──
  const audioBoostRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const [pipActive, setPipActive] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const webgpuSupported = useMemo(() => isWebGPUAvailable(), []);

  // BUG 8 FIX: full teardown on unmount. Navigating away from /watch while
  // a stream was loading or playing used to leave the playback watchdog AND
  // the pending control timers active, left the HLS worker downloading
  // fragments (destroy() alone doesn't stop an in-flight fragment fetch or
  // detach the <video> element), kept fullscreen locked on
  // document.fullscreenElement, and left the decoder's media buffers
  // attached to a dead element. Everything is released here, in order.
  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      // Exit fullscreen if the user navigates away while fullscreen is active
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { /* ignore */ });
      }
      // HLS: stop the loader FIRST (aborts in-flight fragment downloads),
      // then detach media (unbinds from the <video>), then destroy.
      const hls = hlsRef.current;
      if (hls) {
        try { hls.stopLoad(); } catch { /* ignore */ }
        try { hls.detachMedia(); } catch { /* ignore */ }
        hls.destroy();
        hlsRef.current = null;
      }
      // Blank the video element so the browser releases decoder buffers
      const video = videoRef.current;
      if (video) {
        try {
          video.pause();
          video.removeAttribute("src");
          video.load();
        } catch { /* ignore */ }
      }
    };
  }, []);

  // ─── Load stream ───
  // H-1 FIX: depend on stream.url + stream.type (primitive identity), NOT the
  // `stream` object itself. Watch.tsx re-renders during playback (background
  // providers resolving → setAllSources) and used to hand us a NEW stream
  // object each render, which re-ran this effect and destroyed/recreated the
  // HLS instance — restarting playback mid-episode. Same URL ⇒ no reload.
  useEffect(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const url = stream.url;
    resumeAppliedRef.current = false;
    // M-17 FIX: nothing outside the manual toggle ever called play(), so the
    // "autoplay next episode" countdown AND the initial episode click both
    // landed on a paused player with the big center play button. Arm the
    // one-shot autoplay for this new stream — now gated on the Autoplay
    // toggle (animex "Autoplay" setting) so switching it off actually stops
    // the player from starting on its own.
    shouldAutoplayRef.current = settings.autoplay;
    setLoading(true);
    setError(null);
    // L-3 FIX: reset time/buffered state so the seekbar doesn't show the
    // previous episode's position until the new metadata loads.
    setCurrent(0);
    setDuration(0);
    setBuffered(0);

    // BUG 8 FIX: arm the loading watchdog for THIS stream. 20s with no
    // playback → explicit error state instead of an eternal spinner.
    if (playbackTimeoutRef.current) clearTimeout(playbackTimeoutRef.current);
    playbackTimeoutRef.current = setTimeout(() => {
      setLoading(false);
      setError("This stream took too long to start. Try another server.");
    }, 20000);

    // BUG 8 FIX (episode-change path): same teardown discipline as unmount —
    // stop in-flight fragment downloads and detach the old media element
    // BEFORE destroying, so switching episodes never overlaps two loaders.
    if (hlsRef.current) {
      try { hlsRef.current.stopLoad(); } catch { /* ignore */ }
      try { hlsRef.current.detachMedia(); } catch { /* ignore */ }
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
          .map((l, i) => ({ height: l.height, index: i, bitrate: l.bitrate }))
          .filter((l) => l.height > 0)
          .sort((a, b) => b.height - a.height);
        setQualityLevels(levels);
        setLoading(false);
      });
      // M-6 FIX: only mirror the actual playing level into UI state when the
      // user has pinned a manual quality. In Auto mode (currentQuality === -1)
      // overwriting it made the menu checkmark jump from "Auto" to "720p"
      // even though auto-level selection was still active.
      // animex parity: in Auto mode the height is still shown as a live
      // "Auto (1080p)" hint — autoLevelHeight tracks it unconditionally.
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        setAutoLevelHeight(hls.levels[data.level]?.height ?? 0);
        if (!hls.autoLevelEnabled) setCurrentQuality(data.level);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) {
          // Full context — which fragment/level failed and why. Invaluable
          // when a proxy mis-serves a disguised CDN segment (.txt = TS).
          console.error(
            `[hls] fatal ${data.details}`,
            "frag:", data.frag?.url?.split("/").pop() ?? "-",
            "level:", data.level,
            "resp:", data.response?.code,
            "reason:", data.reason ?? "-",
          );
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
      // BUG 8 FIX: episode-change cleanup — clear the watchdog + release the
      // HLS pipeline fully before the next stream loads.
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
      if (hlsRef.current) {
        try { hlsRef.current.stopLoad(); } catch { /* ignore */ }
        try { hlsRef.current.detachMedia(); } catch { /* ignore */ }
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [stream.url, stream.type]);

  // ─── Apply settings ───
  // New stream → reset the subtitle selection to the track the source marked
  // default (AnimeX yuki/sora mark English), or off when there are none.
  useEffect(() => {
    const tracks = stream.tracks ?? [];
    if (tracks.length === 0) {
      setActiveTrackIndex(-1);
      return;
    }
    const defIdx = tracks.findIndex((t) => t.isDefault);
    setActiveTrackIndex(defIdx >= 0 ? defIdx : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.url]);

  // Mirror activeTrackIndex onto the native text tracks whenever it changes
  // (and after the new stream's <track> elements mount).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const tt = video.textTracks;
    for (let i = 0; i < tt.length; i++) {
      const track = tt[i];
      if (track.kind !== "subtitles") continue;
      track.mode = i === activeTrackIndex ? "showing" : "disabled";
    }
  }, [activeTrackIndex, stream.url]);

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

    // BUG 8 FIX: the first successful play disarms the loading watchdog.
    const onPlay = () => {
      setPlaying(true);
      setLoading(false);
      // Audio boost: browsers suspend AudioContexts until a user gesture —
      // resume on every play so boosted volume actually comes back.
      if (audioBoostRef.current) audioBoostRef.current.ctx.resume().catch(() => { /* ignore */ });
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
    };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onLoaded = () => {
      setDuration(video.duration || 0);
      setLoading(false);
      // Native resolution — drives the Anime4K canvas sizing / rebuilds.
      setVideoRes({ w: video.videoWidth, h: video.videoHeight });
      // BUG 8 FIX: metadata arrived — disarm the watchdog (the stream is
      // alive even if autoplay is policy-blocked).
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }
      if (!resumeAppliedRef.current && settings.autoResume && resumeTime && resumeTime > 5 && video.duration > resumeTime) {
        try {
          video.currentTime = resumeTime;
          resumeAppliedRef.current = true;
        } catch { /* ignore */ }
      }
      // M-17 FIX: best-effort autoplay once per stream load. The user's
      // click on the episode/server counts as sticky activation, so this
      // normally succeeds; browser policy rejections are swallowed and the
      // big play button remains as fallback.
      if (shouldAutoplayRef.current) {
        shouldAutoplayRef.current = false;
        video.play().catch(() => { /* autoplay blocked — user can click play */ });
      }
    };
    const onTime = () => {
      setCurrent(video.currentTime);
      if (settings.skipIntro && video.currentTime > 5 && video.currentTime < INTRO_END) {
        setShowSkipIntro(true);
      } else {
        setShowSkipIntro(false);
      }
      // M-15 FIX: the "Show skip outro button" toggle was a dead setting —
      // skipOutro was persisted but read nowhere. Show the button in the last
      // OUTRO_WINDOW seconds (hidden in the final 2s — nothing left to skip).
      if (
        settings.skipOutro &&
        video.duration > 0 &&
        video.currentTime > video.duration - OUTRO_WINDOW &&
        video.currentTime < video.duration - 2
      ) {
        setShowSkipOutro(true);
      } else {
        setShowSkipOutro(false);
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
  // L-19 FIX: settings.skipOutro is read inside onTime but was missing from
  // these deps — a stale closure would have kept the OLD value if the
  // setting ever changed while the player stayed mounted. (skipIntro was
  // already here; skipOutro is the same class of dependency.)
  // settings.autoResume + settings.autoplay joined the same class — they are
  // read inside onLoaded / the load effect respectively.
  }, [resumeTime, settings.skipIntro, settings.skipOutro, settings.autoResume, onProgress, onEnded]);

  // ─── Fullscreen ───
  useEffect(() => {
    const onFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  // ─── Picture-in-Picture state mirror ───
  useEffect(() => {
    if (!PIP_SUPPORTED) return;
    const onEnter = () => setPipActive(true);
    const onLeave = () => setPipActive(false);
    const video = videoRef.current;
    video?.addEventListener("enterpictureinpicture", onEnter);
    video?.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      video?.removeEventListener("enterpictureinpicture", onEnter);
      video?.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, []);

  // ─── Audio boost (animex "Extra volume" 0–200 %) ───
  // Web Audio gain chained after the media element. The MediaElementSource
  // is created lazily ONCE per player lifetime (spec: only one per element),
  // kept across stream switches — the <video> element itself never changes.
  // boost ≤ 0 simply pins the gain to 1 (the node chain stays, but at unity).
  useEffect(() => {
    const boost = settings.audioBoost;
    if (boost <= 0) {
      if (audioBoostRef.current) audioBoostRef.current.gain.gain.value = 1;
      return;
    }
    try {
      if (!audioBoostRef.current) {
        const video = videoRef.current;
        if (!video) return;
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const src = ctx.createMediaElementSource(video);
        const gain = ctx.createGain();
        src.connect(gain);
        gain.connect(ctx.destination);
        audioBoostRef.current = { ctx, gain };
      }
      const ab = audioBoostRef.current;
      ab.ctx.resume().catch(() => { /* gesture-gated */ });
      ab.gain.gain.value = 1 + boost / 100;
    } catch {
      // Web Audio unavailable — the boost slider becomes a no-op.
    }
  }, [settings.audioBoost]);

  // ─── WebGPU renderer (Anime4K) lifecycle ───
  // Restarted ("safely, playback never interrupted") whenever the toggle,
  // the preset or the stream's native resolution changes — the <video>
  // element is never touched, so audio + buffered data are unaffected.
  useEffect(() => {
    const want = settings.anime4kEnabled && webgpuSupported && stream.type !== "iframe";
    let disposed = false;
    (async () => {
      a4kSessionRef.current?.destroy();
      a4kSessionRef.current = null;
      if (!want || !videoRes.w || !canvasRef.current || !videoRef.current) {
        setA4kStatus("off");
        setA4kError(null);
        return;
      }
      setA4kStatus("starting");
      setA4kError(null);
      try {
        const session = await startAnime4k({
          video: videoRef.current,
          canvas: canvasRef.current,
          preset: settings.anime4kPreset,
          onError: (msg) => {
            setA4kStatus("error");
            setA4kError(msg);
            // Auto-restore the plain <video> so playback stays visible.
            updateSettings({ anime4kEnabled: false });
          },
        });
        if (disposed) {
          session.destroy();
          return;
        }
        a4kSessionRef.current = session;
        setA4kStatus("on");
      } catch (e) {
        setA4kStatus("error");
        setA4kError(e instanceof Error ? e.message : String(e));
        updateSettings({ anime4kEnabled: false });
      }
    })();
    return () => {
      disposed = true;
      a4kSessionRef.current?.destroy();
      a4kSessionRef.current = null;
    };
  }, [settings.anime4kEnabled, settings.anime4kPreset, videoRes.w, videoRes.h, stream.url, stream.type, webgpuSupported]);

  // ─── Toast timer + audio graph teardown on unmount ───
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (audioBoostRef.current) {
        try { audioBoostRef.current.ctx.close(); } catch { /* ignore */ }
        audioBoostRef.current = null;
      }
    };
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
    // M-27 FIX: persist the player's volume — the settings-apply effect used
    // to snap it back to settings.volume (default 80) on every episode or
    // server change. The Settings-page slider already persisted; now the
    // in-player slider and the ArrowUp/ArrowDown keys do too.
    updateSettings({ volume: Math.round(val * 100) });
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
    v.currentTime = INTRO_END;
    setShowSkipIntro(false);
  }, []);

  // M-15 FIX: seek to 1s before the end — the natural 'ended' event fires
  // right after, which keeps the onEnded → autoplay-next chain intact.
  const skipOutro = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = Math.max(0, v.duration - 1);
    setShowSkipOutro(false);
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

  // ─── animex-parity control-bar actions ───
  /** CC button — toggles between "off" and the first/default soft-sub track. */
  const toggleSubtitles = useCallback(() => {
    setActiveTrackIndex((idx) => {
      if (idx >= 0) return -1;
      const tracks = stream.tracks ?? [];
      if (tracks.length === 0) {
        showToast("This stream has no subtitle tracks");
        return -1;
      }
      const defIdx = tracks.findIndex((t) => t.isDefault);
      return defIdx >= 0 ? defIdx : 0;
    });
  }, [stream.tracks, showToast]);

  /** Camera button — dump the current frame to a PNG download. */
  const takeScreenshot = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) {
      showToast("Nothing to capture yet");
      return;
    }
    try {
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      const g = c.getContext("2d");
      if (!g) return;
      g.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((blob) => {
        if (!blob) {
          showToast("Screenshot failed");
          return;
        }
        const safe = title.replace(/[^\w\- ]+/g, "").trim() || "XAN";
        const a = document.createElement("a");
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = `${safe} - EP${episode} - ${Math.floor(v.currentTime)}s.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        showToast("Screenshot saved");
      }, "image/png");
    } catch {
      // drawImage on a tainted canvas (cross-origin without CORS) throws.
      showToast("Screenshot blocked for this stream");
    }
  }, [title, episode, showToast]);

  const togglePip = useCallback(async () => {
    const v = videoRef.current as (HTMLVideoElement & { requestPictureInPicture?: () => Promise<void> }) | null;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture?.();
      }
    } catch {
      showToast("Picture-in-picture unavailable");
    }
  }, [showToast]);

  const toggleCast = useCallback(async () => {
    const v = videoRef.current as (HTMLVideoElement & { remote?: { prompt: () => Promise<void> } }) | null;
    try {
      await v?.remote?.prompt();
    } catch {
      // No devices / user cancelled — silently ignore.
    }
  }, []);

  /** Display geometry for the <video>/<canvas> per the Aspect ratio setting. */
  const aspectStyle = useMemo<React.CSSProperties>(() => {
    switch (settings.aspectRatio) {
      case "fill":
      case "16:9":
        return { objectFit: "fill" };
      case "4:3":
        // Container is aspect-video (16:9): a 4:3 box is 27/64 of its width.
        return { width: "42.1875%", height: "100%", objectFit: "fill", display: "block", marginLeft: "auto", marginRight: "auto" };
      default:
        return {};
    }
  }, [settings.aspectRatio]);

  /** Label for the Filters row — mirrors the enhancer's active state. */
  const filtersLabel = !enhancer.rawActive
    ? "Off"
    : enhancer.matchedPresetId
      ? ENHANCER_PRESETS[enhancer.matchedPresetId]?.label ?? "Custom"
      : "Custom";

  const presetLabel = ANIME4K_PRESETS.find((p) => p.id === settings.anime4kPreset)?.label ?? "Mode A";

  // M-7 FIX: stable "play next now" handler. The inline arrow used before was
  // a new identity on every parent render, which (a) restarted the
  // AutoPlayOverlay countdown via its effect deps and (b) made the countdown
  // fire through a state-updater side effect that double-ran in StrictMode.
  const handleAutoPlayNow = useCallback(() => {
    onAutoPlayCancel?.();
    onNext?.();
  }, [onAutoPlayCancel, onNext]);
  const handleAutoPlayCancel = useCallback(() => {
    onAutoPlayCancel?.();
  }, [onAutoPlayCancel]);

  // ─── Mobile double-tap to seek ───
  // L-2 FIX: the pending single-tap timer is now cancelled when a double-tap
  // is detected. Previously the double-tap window (300ms) was longer than the
  // single-tap delay (250ms), so a second tap landing 250–300ms after the
  // first fired BOTH togglePlay (timer) and the ±10s seek.
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
        // Double tap → seek ±10 (cancel the pending single-tap togglePlay)
        if (singleTapTimerRef.current) {
          clearTimeout(singleTapTimerRef.current);
          singleTapTimerRef.current = null;
        }
        fireTapRipple(side, x, e.clientY - rect.top);
        seekBy(side === "left" ? -10 : 10);
        lastTapRef.current = 0;
      } else {
        // Single tap → toggle play (after small delay so double-tap can override)
        lastTapRef.current = now;
        lastTapSideRef.current = side;
        singleTapTimerRef.current = setTimeout(() => {
          singleTapTimerRef.current = null;
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
      // M-18 FIX: never hijack browser/OS shortcuts. Previously Ctrl/Cmd+F
      // (find) toggled fullscreen and Ctrl+1…9 (tab switching) seeked the
      // video, because the digit regex and letter cases ran unconditionally.
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      // Space/Enter on a focused interactive element → let the browser
      // activate it. Previously Space on a focused player button BOTH
      // clicked the button and toggled playback (double action).
      if (
        (e.key === " " || e.key === "Enter") &&
        (tag === "BUTTON" || tag === "A" || tag === "SUMMARY" || el?.getAttribute("role") === "button")
      ) return;

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
        case "Escape":
          // Layered dismissal: settings panel first, then overlays.
          setShowSettings(false);
          setShowShortcuts(false);
          break;
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
          changeVolume(Math.min(1, (videoRef.current?.volume ?? 0) + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          changeVolume(Math.max(0, (videoRef.current?.volume ?? 0) - 0.1));
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
          // L-14 FIX: this used to toggle the enhancer's enabled state AND
          // open/close the panel — two unrelated actions at once, while the
          // on-screen controls separate them (eye = enable, sun = settings)
          // and the tooltip promises only the panel. Match the tooltip.
          e.preventDefault();
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
    changeVolume,
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
  // Icon "Skip Intro" control — actionable only while the intro is still
  // running (duration unknown yet counts as skippable; a clip shorter than
  // the intro window never is).
  const introSkippable =
    current < INTRO_END && (duration === 0 || duration > INTRO_END);
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
        style={{
          ...aspectStyle,
          ...(enhancer.active ? {
            filter: enhancer.filterCss,
            willChange: "filter",
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
          } : {}),
        }}
        playsInline
        onClick={(e) => {
          // Tapping the video while the settings panel is open dismisses the
          // panel instead of pausing — matches YouTube/mobile player UX.
          if (showSettings) {
            setShowSettings(false);
            return;
          }
          handleVideoClick(e);
        }}
      >
        {/* Soft-subtitle tracks (proxied VTT from the AnimeX providers).
            Visibility is driven imperatively by activeTrackIndex. */}
        {stream.tracks?.map((t, i) => (
          <track
            key={`${stream.url}-${i}`}
            src={t.url}
            kind="subtitles"
            label={t.label}
            srcLang={t.lang || "en"}
          />
        ))}
      </video>

      {/* WebGPU (Anime4K) render surface — always mounted so the renderer
          effect can acquire the context; visually swapped in when active.
          pointer-events-none lets taps/clicks fall through to the video. */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full pointer-events-none ${a4kStatus === "on" ? "" : "hidden"}`}
        style={aspectStyle}
      />

      {/* Anime4K starting indicator */}
      {a4kStatus === "starting" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 px-2.5 py-1 rounded-full bg-black/70 backdrop-blur text-[10px] font-bold tracking-wide text-white/90 pointer-events-none">
          ANIME4K · WARMING UP GPU
        </div>
      )}

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
          {/* L-12 FIX: the overlay was message-only — the most failure-prone
              screen in the app had no retry. */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-sm font-medium text-white hover:bg-white/20 transition-colors"
            >
              <RotateCw className="h-4 w-4" /> Retry
            </button>
          )}
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

      {/* Skip Intro button — Netflix-style white pill, always readable on any frame */}
      {showSkipIntro && !loading && !error && (
        <button
          onClick={skipIntro}
          className="absolute bottom-24 right-4 z-20 pl-4 pr-3 py-2 rounded-lg bg-white/95 hover:bg-white text-black text-[13px] font-semibold shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex items-center gap-1.5 animate-fade-in transition-colors focus-visible:ring-2 focus-visible:ring-white outline-none"
        >
          Skip Intro
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* Skip Outro button (M-15) — stacked above Skip Intro so the two
          never overlap on very short videos */}
      {showSkipOutro && !loading && !error && !showSkipIntro && (
        <button
          onClick={skipOutro}
          className="absolute bottom-24 right-4 z-20 pl-4 pr-3 py-2 rounded-lg bg-white/95 hover:bg-white text-black text-[13px] font-semibold shadow-[0_4px_24px_rgba(0,0,0,0.5)] flex items-center gap-1.5 animate-fade-in transition-colors focus-visible:ring-2 focus-visible:ring-white outline-none"
        >
          Skip Outro
          <ChevronRight className="h-4 w-4" />
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
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-black/45 backdrop-blur-sm ring-1 ring-white/15 text-white/90 font-medium">
                {stream.sourceName}
              </span>
              {enhancerActive && (
                <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-xan-crimson/25 text-white ring-1 ring-xan-crimson/50 backdrop-blur-sm">
                  ENHANCED
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Cast (animex top-right) — only rendered when the browser
                exposes the Remote Playback prompt (Chromium + Chromecast). */}
            {CAST_SUPPORTED && (
              <button
                onClick={toggleCast}
                className="h-8 w-8 rounded-lg grid place-items-center text-white/90 hover:bg-white/15 transition-colors focus-visible:ring-2 focus-visible:ring-white/60 outline-none"
                aria-label="Cast"
                title="Cast to a device"
              >
                <Cast className="h-4 w-4" />
              </button>
            )}
            {/* Keyboard shortcuts */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="h-8 w-8 rounded-lg grid place-items-center text-white/90 hover:bg-white/15 transition-colors focus-visible:ring-2 focus-visible:ring-white/60 outline-none"
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
            <div className="w-11 h-11 sm:w-20 sm:h-20 rounded-full bg-xan-crimson/95 hover:bg-xan-crimson flex items-center justify-center shadow-[0_0_48px_rgba(233,69,96,0.45),0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/20 transition-transform hover:scale-105 animate-play-pop">
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
          {settings.skipIntro && duration > INTRO_END && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/70 rounded-full pointer-events-none"
              style={{ left: `${(INTRO_END / duration) * 100}%` }}
              title="Intro"
            />
          )}
          {/* Thumb — visible on hover with a soft crimson halo */}
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-xan-crimson shadow-[0_0_0_4px_rgba(233,69,96,0.25)] opacity-0 scale-50 group-hover/seek:opacity-100 group-hover/seek:scale-100 transition-all pointer-events-none"
            style={{ left: `${pct}%` }}
          />
          {/* Hover tooltip — glass chip */}
          {hoverPct != null && (
            <div
              className="absolute -top-8 -translate-x-1/2 px-2 py-0.5 rounded-md bg-[#101014]/95 ring-1 ring-white/10 text-white text-[11px] font-mono tabular-nums pointer-events-none whitespace-nowrap shadow-lg"
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
              className={CTRL_BTN}
              aria-label={playing ? "Pause" : "Play"}
              title={playing ? "Pause (k)" : "Play (k)"}
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-white" />}
            </button>

            {/* Volume — tap to expand slider (YouTube-style) */}
            <div className="flex items-center flex-shrink-0">
              <button
                onClick={() => setShowVolumeSlider((v) => !v)}
                className={CTRL_BTN}
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
              className="text-xs font-mono tabular-nums px-1.5 py-1 rounded-md hover:bg-white/10 transition-colors whitespace-nowrap flex-shrink-0 hidden sm:block text-white/90"
              title="Click to toggle remaining time"
            >
              {timeMode === "duration"
                ? `${fmt(current)} / ${fmt(duration)}`
                : `${fmt(current)} / -${fmt(remainingTime)}`}
            </button>
          </div>

          {/* Right cluster — animex.one order: −10s · +10s · CC · Screenshot ·
              Settings · PiP · Fullscreen (episode prev/next live on the
              sidebar episode grid + N/P keys, exactly like the original). */}
          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
            {/* −10 seconds */}
            <button
              onClick={() => seekBy(-10)}
              className={CTRL_BTN}
              aria-label="Back 10 seconds"
              title="Back 10s (J)"
            >
              <span className="relative inline-flex">
                <RotateCcw className="h-5 w-5" />
                <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold leading-none">10</span>
              </span>
            </button>
            {/* +10 seconds */}
            <button
              onClick={() => seekBy(10)}
              className={CTRL_BTN}
              aria-label="Forward 10 seconds"
              title="Forward 10s (L)"
            >
              <span className="relative inline-flex">
                <RotateCw className="h-5 w-5" />
                <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold leading-none">10</span>
              </span>
            </button>
            {/* Skip Intro — icon-only control beside the seek buttons.
                Crimson while the intro window is live (mirrors the floating
                pill), dimmed once passed so the row never lies about what
                the button will do. */}
            <button
              onClick={() => {
                if (introSkippable) skipIntro();
              }}
              className={`${CTRL_BTN} ${
                introSkippable
                  ? "text-xan-crimson hover:bg-xan-crimson/15"
                  : "text-white/30 hover:bg-transparent active:bg-transparent"
              }`}
              aria-label="Skip intro"
              aria-disabled={!introSkippable}
              title={introSkippable ? "Skip intro" : "No intro to skip"}
            >
              <SkipForward className="h-5 w-5" />
            </button>
            {/* Subtitles (CC) */}
            <button
              onClick={toggleSubtitles}
              className={`${CTRL_BTN} ${activeTrackIndex >= 0 ? "text-xan-crimson" : "text-white"}`}
              aria-label="Toggle subtitles"
              title={activeTrackIndex >= 0 ? "Subtitles ON" : "Subtitles OFF"}
            >
              <Captions className="h-5 w-5" />
            </button>
            {/* Screenshot */}
            <button
              onClick={takeScreenshot}
              className={`${CTRL_BTN} hidden sm:grid`}
              aria-label="Screenshot"
              title="Save a screenshot"
            >
              <Camera className="h-5 w-5" />
            </button>
            {/* Settings (gear) — floating panel anchored above this button.
                The gear rotates a quarter turn while open (aria-expanded). */}
            <button
              onClick={() => setShowSettings((v) => !v)}
              className={`${CTRL_BTN} ${showSettings ? "bg-white/[0.14]" : ""}`}
              aria-label="Settings"
              aria-expanded={showSettings}
              title="Settings"
            >
              <Settings className={`h-5 w-5 transition-transform duration-300 ${showSettings ? "rotate-90" : ""}`} />
            </button>
            {/* Picture-in-Picture */}
            {PIP_SUPPORTED && (
              <button
                onClick={togglePip}
                className={`${CTRL_BTN} hidden sm:grid ${pipActive ? "text-xan-crimson" : "text-white"}`}
                aria-label="Picture-in-picture"
                title="Picture-in-picture (I)"
              >
                <PictureInPicture2 className="h-5 w-5" />
              </button>
            )}
            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className={CTRL_BTN}
              aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title={fullscreen ? "Exit fullscreen (F)" : "Fullscreen (F)"}
            >
              {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Settings panel — floating glass menu anchored above the gear
          (YouTube/Netflix placement). Segmented tabs, inset rows, thin
          scrollbar; the control bar stays visible and clickable. ── */}
      {showSettings && (
        <div
          role="dialog"
          aria-label="Player settings"
          className="absolute z-50 left-3 right-3 bottom-16 sm:left-auto sm:right-3 sm:bottom-[68px] sm:w-[320px] max-h-[calc(100%-88px)] flex flex-col rounded-[14px] bg-[#101014]/[0.92] backdrop-blur-2xl ring-1 ring-white/10 shadow-[0_16px_48px_-8px_rgba(0,0,0,0.8)] text-white animate-menu-in origin-bottom-right overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header — segmented control + close */}
          <div className="flex items-center gap-1.5 px-2.5 pt-2.5 pb-1 flex-shrink-0">
            <div className="flex flex-1 items-center rounded-[10px] bg-white/[0.06] p-0.5">
              {([
                ["quality", "Quality"],
                ["subs", "Subs"],
                ["settings", "Player"],
                ["servers", "Servers"],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => { setSettingsTab(id); setSettingsPage("main"); settingsScrollRef.current?.scrollTo({ top: 0 }); }}
                  className={`flex-1 rounded-[8px] px-0.5 py-1.5 text-[10px] font-semibold tracking-wide text-center transition-all ${
                    settingsTab === id
                      ? "bg-white/[0.14] text-white shadow-sm"
                      : "text-white/45 hover:text-white/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="h-7 w-7 rounded-full grid place-items-center flex-shrink-0 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close settings"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={settingsScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden xan-menu-scroll px-1.5 pb-1.5">
            {/* ── QUALITY ── */}
            {settingsTab === "quality" && (
              <div>
                <SectionLabel>Quality</SectionLabel>
                {qualityLevels.length === 0 && (
                  <p className="px-3 py-2 text-xs text-white/45">Single quality for this stream.</p>
                )}
                <button onClick={() => changeQuality(-1)} className={MENU_ROW}>
                  <span>Auto{autoLevelHeight > 0 ? ` · ${autoLevelHeight}p` : ""}</span>
                  {currentQuality === -1 && <Check className="h-4 w-4 text-xan-crimson flex-shrink-0" />}
                </button>
                {qualityLevels.map((lvl) => (
                  <button key={lvl.index} onClick={() => changeQuality(lvl.index)} className={MENU_ROW}>
                    <span>{lvl.height}p{lvl.bitrate ? ` · ${fmtBitrate(lvl.bitrate)}` : ""}</span>
                    {currentQuality === lvl.index && <Check className="h-4 w-4 text-xan-crimson flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {/* ── SUBTITLES ── */}
            {settingsTab === "subs" && (
              <div>
                <SectionLabel>Subtitles</SectionLabel>
                {(stream.tracks?.length ?? 0) === 0 ? (
                  <p className="px-3 py-2 text-xs text-white/45">No subtitle tracks for this stream.</p>
                ) : (
                  <>
                    <button onClick={() => setActiveTrackIndex(-1)} className={MENU_ROW}>
                      <span>Off</span>
                      {activeTrackIndex === -1 && <Check className="h-4 w-4 text-xan-crimson flex-shrink-0" />}
                    </button>
                    {(stream.tracks ?? []).map((t, i) => (
                      <button
                        key={`${t.url}-${i}`}
                        onClick={() => setActiveTrackIndex(i)}
                        className={MENU_ROW}
                      >
                        <span className="truncate">{t.label}</span>
                        {activeTrackIndex === i && <Check className="h-4 w-4 text-xan-crimson flex-shrink-0" />}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ── SETTINGS (main) ── */}
            {settingsTab === "settings" && settingsPage === "main" && (
              <div className="pb-2">
                <SectionLabel>Playback</SectionLabel>
                <SettingToggle
                  label="Autoplay"
                  hint="Start playing automatically"
                  on={settings.autoplay}
                  onChange={(v) => updateSettings({ autoplay: v })}
                />
                <SettingToggle
                  label="Smart resume"
                  hint="Pick up where you left off"
                  on={settings.autoResume}
                  onChange={(v) => updateSettings({ autoResume: v })}
                />
                <SettingToggle
                  label="Auto play next episode"
                  on={settings.autoNext}
                  onChange={(v) => updateSettings({ autoNext: v })}
                />
                <SettingToggle
                  label="Auto skip intro"
                  on={settings.skipIntro}
                  onChange={(v) => updateSettings({ skipIntro: v })}
                />
                <SettingToggle
                  label="Auto skip outro"
                  on={settings.skipOutro}
                  onChange={(v) => updateSettings({ skipOutro: v })}
                />

                <SectionLabel>Speed</SectionLabel>
                <div className="px-3 py-1.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-white/85">Playback speed</span>
                    <span className="text-[11px] font-mono font-bold tabular-nums text-xan-crimson bg-white/[0.08] rounded-md px-1.5 py-0.5">{fmtRate(playbackRate)}x</span>
                  </div>
                  <div className="relative h-4 flex items-center">
                    <div className="absolute left-0 right-0 h-1 rounded-full bg-white/[0.14]" />
                    <div
                      className="absolute left-0 h-1 rounded-full bg-xan-crimson shadow-[0_0_8px_rgba(233,69,96,0.5)] transition-all"
                      style={{ width: `${((playbackRate - 0.25) / (2 - 0.25)) * 100}%` }}
                    />
                    <div
                      className="absolute w-2.5 h-2.5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.5)] pointer-events-none"
                      style={{ left: `calc(${((playbackRate - 0.25) / (2 - 0.25)) * 100}% - 5px)` }}
                    />
                    <input
                      type="range" min={0.25} max={2} step={0.05}
                      value={playbackRate}
                      onChange={(e) => changePlaybackRate(Number(e.target.value))}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                      style={{ WebkitAppearance: "none", appearance: "none", background: "transparent" }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-white/30 mt-1 px-0.5 tabular-nums">
                    <span>0.25x</span><span>1x</span><span>2x</span>
                  </div>
                </div>

                <SectionLabel>Display</SectionLabel>
                <button
                  onClick={() => setShowEnhancer(true)}
                  className={MENU_ROW}
                >
                  <span>Filters</span>
                  <span className="flex items-center gap-1.5 text-white/60">
                    {filtersLabel}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </button>
                <button
                  onClick={() => setAspectOpen((v) => !v)}
                  className={MENU_ROW}
                >
                  <span>Aspect ratio</span>
                  <span className="flex items-center gap-1.5 text-white/60">
                    {settings.aspectRatio === "auto" ? "Auto" : settings.aspectRatio === "fill" ? "Fill" : settings.aspectRatio}
                    <ChevronRight className={`h-3.5 w-3.5 transition-transform ${aspectOpen ? "rotate-90" : ""}`} />
                  </span>
                </button>
                {aspectOpen && (
                  <div className="pb-1">
                    {(["auto", "fill", "16:9", "4:3"] as const).map((value) => (
                      <button
                        key={value}
                        onClick={() => { updateSettings({ aspectRatio: value }); setAspectOpen(false); }}
                        className="flex items-center justify-between w-full pl-9 pr-3 py-2 text-[12px] text-white/70 hover:text-white rounded-[10px] hover:bg-white/[0.05] transition-colors"
                      >
                        <span>{value === "auto" ? "Auto" : value === "fill" ? "Fill" : value}</span>
                        {settings.aspectRatio === value && <Check className="h-3.5 w-3.5 text-xan-crimson" />}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setSettingsPage("renderer")}
                  className={MENU_ROW}
                >
                  <span>Anime4K</span>
                  <span className="flex items-center gap-1.5 text-white/60">
                    {settings.anime4kEnabled ? `On — ${presetLabel}` : "Off"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </button>

                <SectionLabel>Audio boost</SectionLabel>
                <div className="px-3 py-1.5 pb-2.5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[13px] text-white/85">Extra volume</span>
                    <span className="text-[11px] font-mono font-bold tabular-nums text-xan-crimson bg-white/[0.08] rounded-md px-1.5 py-0.5">{settings.audioBoost}%</span>
                  </div>
                  <div className="relative h-4 flex items-center">
                    <div className="absolute left-0 right-0 h-1 rounded-full bg-white/[0.14]" />
                    <div
                      className="absolute left-0 h-1 rounded-full bg-xan-crimson shadow-[0_0_8px_rgba(233,69,96,0.5)] transition-all"
                      style={{ width: `${(settings.audioBoost / 200) * 100}%` }}
                    />
                    <div
                      className="absolute w-2.5 h-2.5 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.5)] pointer-events-none"
                      style={{ left: `calc(${(settings.audioBoost / 200) * 100}% - 5px)` }}
                    />
                    <input
                      type="range" min={0} max={200} step={5}
                      value={settings.audioBoost}
                      onChange={(e) => updateSettings({ audioBoost: Number(e.target.value) })}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute inset-0 w-full opacity-0 cursor-pointer"
                      style={{ WebkitAppearance: "none", appearance: "none", background: "transparent" }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-white/30 mt-1 px-0.5 tabular-nums">
                    <span>Off</span><span>100%</span><span>200%</span>
                  </div>
                  <p className="text-[10px] text-white/40 mt-2 leading-snug">
                    Boost volume above the player's normal maximum.
                  </p>
                </div>
              </div>
            )}

            {/* ── SETTINGS → WEBGPU RENDERER (sub-page) ── */}
            {settingsTab === "settings" && settingsPage === "renderer" && (
              <div className="pb-2">
                <button
                  onClick={() => setSettingsPage("main")}
                  className="flex items-center gap-1.5 w-full rounded-[10px] px-3 py-2.5 mt-1.5 text-[12px] font-medium text-white/70 hover:text-white hover:bg-white/[0.07] transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back to Player
                </button>

                <SectionLabel>WebGPU renderer</SectionLabel>
                <SettingToggle
                  label="Enable Anime4K"
                  hint="Clearer anime upscaling. Uses extra GPU and battery."
                  on={settings.anime4kEnabled}
                  disabled={!webgpuSupported}
                  onChange={(v) => updateSettings({ anime4kEnabled: v })}
                />
                {!webgpuSupported && (
                  <p className="px-3 pb-2 text-[11px] text-amber-400/80">
                    WebGPU is not available in this browser — try Chrome or Edge.
                  </p>
                )}
                {a4kError && (
                  <p className="px-3 pb-2 text-[11px] text-xan-crimson/90">{a4kError}</p>
                )}

                <SectionLabel>Shader pipeline</SectionLabel>
                {ANIME4K_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => updateSettings({ anime4kPreset: p.id })}
                    className={MENU_ROW}
                  >
                    <span className="min-w-0">
                      <span className="block">{p.label}</span>
                      <span className="block text-[10px] text-white/40 leading-snug">{p.desc}</span>
                    </span>
                    {settings.anime4kPreset === p.id && <Check className="h-4 w-4 text-xan-crimson flex-shrink-0" />}
                  </button>
                ))}
                <p className="px-3 pt-2.5 text-[10px] text-white/40 leading-relaxed">
                  Presets select a tested Anime4K shader chain. Changing the preset
                  safely restarts the GPU renderer — playback is never interrupted.
                </p>
                {a4kStatus === "starting" && (
                  <p className="px-3 pt-2 text-[11px] text-white/60">Starting the GPU renderer…</p>
                )}
              </div>
            )}

            {/* ── SERVERS ── */}
            {settingsTab === "servers" && (
              <div>
                <SectionLabel>Servers</SectionLabel>
                {serversLoading && (
                  <p className="px-3 py-2 text-xs text-white/50">Resolving servers…</p>
                )}
                {(!servers || servers.length === 0) && !serversLoading && (
                  <p className="px-3 py-2 text-xs text-white/50">No servers resolved yet.</p>
                )}
                {(servers ?? []).map((s) => (
                  <button
                    key={s.url}
                    onClick={() => { onServerSelect?.(s.url); setShowSettings(false); }}
                    className={MENU_ROW}
                    title={s.group}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{s.label}</span>
                      <span className="block text-[9px] font-bold tracking-wider uppercase text-white/40">{s.group}</span>
                    </span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-md ${
                        s.type === "iframe" ? "bg-purple-500/20 text-purple-300"
                        : s.type === "hls" ? "bg-blue-500/20 text-blue-300"
                        : "bg-green-500/20 text-green-300"
                      }`}>
                        {s.type}
                      </span>
                      {s.active && <Check className="h-4 w-4 text-xan-crimson flex-shrink-0" />}
                    </span>
                  </button>
                ))}
                {(servers?.length ?? 0) > 0 && (
                  <p className="px-3 pt-2.5 pb-1.5 text-[10px] text-white/40 leading-relaxed">
                    If the current server doesn't work, try another one — playback switches instantly.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Screenshot / action toast */}
      {toast && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[60] px-3 py-1.5 rounded-lg bg-[#101014]/95 ring-1 ring-white/10 backdrop-blur text-white text-xs animate-fade-in pointer-events-none whitespace-nowrap shadow-xl">
          {toast}
        </div>
      )}

      {/* Overlays */}
      <KeyboardShortcutsOverlay open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <VideoEnhancerPanel open={showEnhancer} onClose={() => setShowEnhancer(false)} />
      <AutoPlayOverlay
        open={autoPlayNext}
        onCancel={handleAutoPlayCancel}
        onPlayNow={handleAutoPlayNow}
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

/** HLS bitrate → animex-style label: "800 kbps" / "2.8 Mbps". */
function fmtBitrate(bps: number): string {
  if (!isFinite(bps) || bps <= 0) return "";
  if (bps >= 1_000_000) {
    const mb = bps / 1_000_000;
    return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10} Mbps`;
  }
  return `${Math.round(bps / 1_000)} kbps`;
}

/** 1 → "1", 1.25 → "1.25" — appended with x in the UI. */
function fmtRate(rate: number): string {
  return Number.isInteger(rate) ? String(rate) : String(Math.round(rate * 100) / 100);
}
