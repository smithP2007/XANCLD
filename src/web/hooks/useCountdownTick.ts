import { useState, useEffect } from "react";

/**
 * Shared single-interval tick — every component using this hook reads from
 * ONE global setInterval, instead of each mounting its own.
 *
 * Tick fires once per second. Components compute remaining time by
 * subtracting `now` from their target timestamp.
 */

let currentNow = Date.now();
const subscribers = new Set<(n: number) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function ensureTimer() {
  if (timer) return;
  timer = setInterval(() => {
    currentNow = Date.now();
    for (const sub of subscribers) sub(currentNow);
  }, 1000);
}

function stopTimerIfEmpty() {
  if (subscribers.size === 0 && timer) {
    clearInterval(timer);
    timer = null;
  }
}

export function useCountdownTick(): number {
  const [now, setNow] = useState<number>(currentNow);

  useEffect(() => {
    // Start fresh in case this is the first subscriber since page load
    setNow(Date.now());
    // L-7 FIX: isMounted guard prevents setState on unmounted component
    let isMounted = true;
    const unsub = (n: number) => {
      if (isMounted) setNow(n);
    };
    subscribers.add(unsub);
    ensureTimer();
    return () => {
      isMounted = false;
      subscribers.delete(unsub);
      stopTimerIfEmpty();
    };
  }, []);

  return now;
}

/** Format seconds remaining as "Xd Yh Zm Ws" or "Yh Zm Ws" etc. */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Aired";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Format a past timestamp as "Just now" / "5m ago" / "2d ago" / "Mar 3" */
export function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
