// ─── Zen (FlixCloud) player bridge ────────────────────────────────
// Protocol reverse-engineered from reanime.to, whose HD-1/HD-2 servers are
// the SAME flixcloud.cc embeds that XANCLD's Zen provider iframes. reanime
// gets far more out of those embeds than a bare iframe:
//
//   URL params the embed understands (parsed server-side, baked into the
//   player payload):
//     start_at=<seconds>  resume playback at N seconds
//     skI=true|false      auto-skip intro (player seeks past intro_chapter)
//     skO=true|false      auto-skip outro
//     autoPlay=true       start playing on load
//     a=1                 default to the English/dub audio track
//
//   Player → parent postMessage:
//     { zenCommand: "enterFullscreen" | "exitFullscreen" |
//                   "toggleFullscreen" | "getFullscreenState" }
//     { zenCommand: "openUrl", url }        // download links (/d/…)
//     { playerStatus: "…" }                 // e.g. "Error"
//     { currentTime, duration }             // reply to getTime
//     { playerStatus }                      // reply to getStatus
//
//   Parent → player postMessage:
//     { command: "seek" | "play" | "pause" | "mute" | "unmute" |
//                "volume" | "getTime" | "getStatus" | "updatePreferences",
//       value?: … }
//     { zenFullscreenState: boolean }       // fullscreen sync reply
//
// reanime drives resume, auto-next, progress saving and server fallback off
// this bridge. This module ports that integration to XANCLD.

import { useEffect, useRef, useCallback } from "react";

// ─── URL helpers ──────────────────────────────────────────────

/** True when the URL is a flixcloud.cc embed (the only player the bridge speaks to). */
export function isZenEmbedUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "flixcloud.cc";
  } catch {
    return false;
  }
}

export interface ZenEmbedOptions {
  /** Resume position in seconds (0/undefined = start from beginning). */
  startAt?: number;
  /** Auto-skip the intro chapter. */
  skipIntro?: boolean;
  /** Auto-skip the outro chapter. */
  skipOutro?: boolean;
  /** Start playing immediately on load. */
  autoPlay?: boolean;
  /** Default to the English/dub audio track (a=1). */
  dub?: boolean;
}

/**
 * Decorate a flixcloud embed URL with player preferences, mirroring
 * reanime's server-URL decorator (skI/skO are ALWAYS sent explicitly —
 * the player treats "false" as a real preference, not an omission).
 */
export function buildZenEmbedUrl(url: string, opts: ZenEmbedOptions): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "flixcloud.cc") return url;
    if (opts.startAt && opts.startAt > 0 && isFinite(opts.startAt)) {
      u.searchParams.set("start_at", String(Math.floor(opts.startAt)));
    }
    u.searchParams.set("skI", opts.skipIntro ? "true" : "false");
    u.searchParams.set("skO", opts.skipOutro ? "true" : "false");
    if (opts.autoPlay) u.searchParams.set("autoPlay", "true");
    if (opts.dub) u.searchParams.set("a", "1");
    return u.toString();
  } catch {
    return url;
  }
}

// ─── Bridge hook ──────────────────────────────────────────────

export interface ZenBridgeOptions {
  /** Only mount listeners / start polling when a Zen iframe is shown. */
  enabled: boolean;
  /** Ref to the <iframe> element hosting the flixcloud player. */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** The iframe's src — changes reset the one-shot guards (new stream/episode). */
  streamKey: string;
  /** Element that should receive page-level fullscreen (the player wrapper). */
  getFullscreenElement: () => HTMLElement | null;
  /** Saved resume position (seconds) — sent as a seek command once the player reports time. */
  resumeSeconds?: number;
  skipIntro?: boolean;
  skipOutro?: boolean;
  autoPlay?: boolean;
  /** Throttled progress reports from the iframe player (≥3s apart). */
  onProgress?: (currentTime: number, duration: number) => void;
  /** Fired once when the player reports it reached the end. */
  onEnded?: () => void;
  /** Fired once when the player reports a fatal error. */
  onError?: () => void;
}

const POLL_INTERVAL_MS = 4000;
const PROGRESS_MIN_DELTA_S = 3;
const END_EPSILON_S = 1.5;

export function useZenBridge(opts: ZenBridgeOptions): void {
  const {
    enabled,
    iframeRef,
    streamKey,
    getFullscreenElement,
    resumeSeconds = 0,
    skipIntro = false,
    skipOutro = false,
    autoPlay = false,
    onProgress,
    onEnded,
    onError,
  } = opts;

  // Latest callback/options in refs so the message listener stays attached
  // for the iframe's lifetime (a re-attached listener is fine, but these refs
  // keep the polling interval and handler identity stable).
  const cbRef = useRef(opts);
  cbRef.current = opts;

  const pollTimerRef = useRef<number | null>(null);
  const lastProgressRef = useRef<{ t: number; at: number }>({ t: 0, at: 0 });
  // One-shot guards — reset whenever the iframe URL changes (key).
  const prefsSentRef = useRef(false);
  const resumeSentRef = useRef(false);
  const endedSentRef = useRef(false);
  const errorSentRef = useRef(false);
  const lastUrlRef = useRef<string>("");

  const sendToPlayer = useCallback(
    (payload: Record<string, unknown>) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      try {
        win.postMessage(payload, "*");
      } catch {
        // iframe not ready / cross-origin teardown — harmless
      }
    },
    [iframeRef],
  );

  const pollOnce = useCallback(() => {
    sendToPlayer({ command: "getTime" });
    window.setTimeout(() => sendToPlayer({ command: "getStatus" }), 50);
  }, [sendToPlayer]);

  // ── Incoming messages + polling lifecycle ──
  useEffect(() => {
    if (!enabled) return;

    const onMessage = (ev: MessageEvent) => {
      // Only accept messages that come from our player iframe.
      const win = iframeRef.current?.contentWindow;
      if (!win || ev.source !== win) return;
      const data: unknown = ev.data;
      if (!data || typeof data !== "object") return;
      const msg = data as Record<string, unknown>;

      // ── Fullscreen bridge (player's own fullscreen button) ──
      if (typeof msg.zenCommand === "string") {
        switch (msg.zenCommand) {
          case "enterFullscreen": {
            const el = cbRef.current.getFullscreenElement();
            if (el && !document.fullscreenElement) {
              el.requestFullscreen().catch(() => {});
            }
            return;
          }
          case "exitFullscreen": {
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            }
            return;
          }
          case "toggleFullscreen": {
            const el = cbRef.current.getFullscreenElement();
            if (document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
            } else if (el) {
              el.requestFullscreen().catch(() => {});
            }
            return;
          }
          case "getFullscreenState": {
            // Reply so the player can suppress its own double-click fullscreen.
            try {
              ev.source?.postMessage(
                { zenFullscreenState: !!document.fullscreenElement },
                "*",
              );
            } catch {
              // ignore
            }
            return;
          }
          case "openUrl": {
            // Download links — same hardening as reanime: the URL must share
            // the sender's origin and point at a /d/ path.
            const url = typeof msg.url === "string" ? msg.url : "";
            try {
              const parsed = new URL(url);
              if (parsed.origin === ev.origin && parsed.pathname.startsWith("/d/")) {
                window.open(parsed.href, "_blank", "noopener,noreferrer");
              }
            } catch {
              // ignore malformed URLs
            }
            return;
          }
        }
      }

      // ── Status broadcasts ──
      if (typeof msg.playerStatus === "string") {
        if (msg.playerStatus === "Error" && !errorSentRef.current) {
          errorSentRef.current = true;
          cbRef.current.onError?.();
        }
        return;
      }

      // ── getTime replies → progress / resume / prefs / end detection ──
      const t = typeof msg.currentTime === "number" ? msg.currentTime : undefined;
      const d = typeof msg.duration === "number" ? msg.duration : undefined;
      if (t === undefined && d === undefined) return;

      const now = Date.now();
      const last = lastProgressRef.current;
      const meaningful = typeof d === "number" && d > 0;

      // First real time report → push preferences.
      if (meaningful && !prefsSentRef.current) {
        prefsSentRef.current = true;
        sendToPlayer({
          command: "updatePreferences",
          value: {
            skipIntro: !!cbRef.current.skipIntro,
            skipOutro: !!cbRef.current.skipOutro,
            autoPlay: !!cbRef.current.autoPlay,
          },
        });
      }
      // Resume seek — belt-and-braces alongside the start_at URL param.
      // L-22 FIX: this used to live INSIDE the prefs block, so a first
      // report carrying duration but no currentTime marked prefs as sent
      // and skipped the seek forever. It now has its own one-shot guard.
      const resume = cbRef.current.resumeSeconds ?? 0;
      if (
        meaningful &&
        resume > 5 &&
        t !== undefined &&
        t < resume - 2 &&
        !resumeSentRef.current
      ) {
        resumeSentRef.current = true;
        sendToPlayer({ command: "seek", value: Math.floor(resume) });
      }

      if (typeof t === "number" && meaningful) {
        // Throttled progress saves (reamime throttles to 3s too).
        if (t - last.t >= PROGRESS_MIN_DELTA_S || now - last.at >= PROGRESS_MIN_DELTA_S * 1000) {
          lastProgressRef.current = { t, at: now };
          cbRef.current.onProgress?.(t, d as number);
        }
        // End detection → autoplay next episode.
        if (!endedSentRef.current && t > 0 && t >= d - END_EPSILON_S) {
          endedSentRef.current = true;
          cbRef.current.onProgress?.(t, d as number);
          cbRef.current.onEnded?.();
        }
      }
    };

    window.addEventListener("message", onMessage);

    // Poll getTime/getStatus — once shortly after mount, then periodically
    // while the tab is visible (reanime does the same 1s-after-load pattern).
    pollTimerRef.current = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      pollOnce();
    }, POLL_INTERVAL_MS);
    const initialTimer = window.setTimeout(pollOnce, 1000);

    // Fullscreen state sync — the player listens for this to avoid fighting
    // the page's fullscreen (it disables its own double-click fullscreen).
    const onFsChange = () => {
      sendToPlayer({ zenFullscreenState: !!document.fullscreenElement });
    };
    document.addEventListener("fullscreenchange", onFsChange);

    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("fullscreenchange", onFsChange);
      if (pollTimerRef.current !== null) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      clearTimeout(initialTimer);
    };
  }, [enabled, iframeRef, pollOnce, sendToPlayer]);

  // Reset one-shot guards when the iframe swaps to a different stream/episode.
  useEffect(() => {
    if (streamKey !== lastUrlRef.current) {
      lastUrlRef.current = streamKey;
      prefsSentRef.current = false;
      resumeSentRef.current = false;
      endedSentRef.current = false;
      errorSentRef.current = false;
      lastProgressRef.current = { t: 0, at: 0 };
    }
  }, [streamKey]);
}
