import { useState, useEffect, useCallback } from "react";

export interface XanSettings {
  theme: "dark" | "light" | "system";
  autoplay: boolean;
  skipIntro: boolean;
  skipOutro: boolean;
  autoResume: boolean;
  defaultMode: "sub" | "dub";
  volume: number;
  playbackRate: number;
  hideSpoilers: boolean;
  hideAdult: boolean;
  reducedMotion: boolean;
  tvMode: boolean;
  // Bandwidth / source
  bandwidthMode: "auto" | "direct-only" | "proxy-only";
  preferredProvider: "allanime" | "koto" | "zen" | "gogoanime";
  // Enhancer
  enhancerEnabled: boolean;
}

const DEFAULTS: XanSettings = {
  theme: "dark",
  autoplay: true,
  skipIntro: true,
  skipOutro: false,
  autoResume: true,
  defaultMode: "sub",
  volume: 80,
  playbackRate: 1,
  hideSpoilers: false,
  hideAdult: false,
  reducedMotion: false,
  tvMode: false,
  bandwidthMode: "auto",
  preferredProvider: "allanime",
  enhancerEnabled: true,
};

const STORAGE_KEY = "xan:settings";

function loadSettings(): XanSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULTS;
}

// Global state with pub/sub so all components stay in sync
let currentSettings: XanSettings = DEFAULTS;
const subscribers = new Set<(s: XanSettings) => void>();

// Initialize from localStorage on the client
if (typeof window !== "undefined") {
  currentSettings = loadSettings();
}

function notify() {
  for (const sub of subscribers) {
    sub(currentSettings);
  }
}

export function applyRuntimeFlags(s: XanSettings): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("xan-reduce-motion", s.reducedMotion);
  root.classList.toggle("xan-tv-mode", s.tvMode);
}

export function updateSettings(updates: Partial<XanSettings>): void {
  currentSettings = { ...currentSettings, ...updates };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
  } catch {
    // ignore
  }
  notify();
  // Apply theme immediately
  if (updates.theme) {
    applyTheme(updates.theme);
  }
  applyRuntimeFlags(currentSettings);
}

export function applyTheme(theme: "dark" | "light" | "system"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  let actual: "dark" | "light";
  if (theme === "system") {
    actual = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } else {
    actual = theme;
  }
  if (actual === "light") {
    root.classList.remove("dark");
    root.style.colorScheme = "light";
    document.body.style.backgroundColor = "#fafafa";
    document.body.style.color = "#0a0a0a";
  } else {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
    document.body.style.backgroundColor = "#0a0a0a";
    document.body.style.color = "#fafafa";
  }
  // Apply reduced-motion + tv-mode kill switches
  root.classList.toggle("xan-reduce-motion", false); // toggled below via dedicated settings
  root.classList.toggle("xan-tv-mode", false);
}

export function useSettings(): [XanSettings, (updates: Partial<XanSettings>) => void] {
  const [settings, setSettings] = useState<XanSettings>(currentSettings);

  useEffect(() => {
    // Load from localStorage on mount
    currentSettings = loadSettings();
    setSettings(currentSettings);
    applyTheme(currentSettings.theme);
    applyRuntimeFlags(currentSettings);

    // React to OS theme changes when in "system" mode
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSchemeChange = () => {
      if (currentSettings.theme === "system") applyTheme("system");
    };
    mq.addEventListener("change", onSchemeChange);

    const unsub = (s: XanSettings) => setSettings(s);
    subscribers.add(unsub);
    return () => {
      subscribers.delete(unsub);
      mq.removeEventListener("change", onSchemeChange);
    };
  }, []);

  const update = useCallback((updates: Partial<XanSettings>) => {
    updateSettings(updates);
  }, []);

  return [settings, update];
}

// ─── Watch history hook ────────────────────────────────────────
export interface HistoryEntry {
  animeId: number;
  title: string;
  coverImage: string;
  episode: number;
  timestamp: number;
  duration: number;
  updatedAt: number;
}

const HISTORY_KEY = "xan:history";

export function getHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) {
      return JSON.parse(raw) as HistoryEntry[];
    }
  } catch {
    // ignore
  }
  return [];
}

export function addToHistory(entry: Omit<HistoryEntry, "updatedAt">): void {
  try {
    const history = getHistory();
    // Remove existing entry for same anime+episode
    const filtered = history.filter(
      (e) => !(e.animeId === entry.animeId && e.episode === entry.episode),
    );
    // Add new entry at the front
    filtered.unshift({ ...entry, updatedAt: Date.now() });
    // Cap at 50 entries
    const capped = filtered.slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));
    // Notify subscribers (History page, ContinueWatching, etc.)
    notifyHistorySubscribers();
  } catch {
    // ignore
  }
}

export function removeFromHistory(animeId: number, episode: number): void {
  try {
    const history = getHistory();
    const filtered = history.filter(
      (e) => !(e.animeId === animeId && e.episode === episode),
    );
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
    notifyHistorySubscribers();
  } catch {
    // ignore
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
    notifyHistorySubscribers();
  } catch {
    // ignore
  }
}

// ─── History pub/sub (like useBookmarks) ───────────────────────
// Ensures the History page, ContinueWatching, and Home page history section
// all update in real-time when addToHistory/removeFromHistory/clearHistory
// is called from the Watch page.
const HISTORY_SYNC_EVENT = "xan-history-sync";

function notifyHistorySubscribers(): void {
  if (typeof window === "undefined") return;
  queueMicrotask(() => window.dispatchEvent(new CustomEvent(HISTORY_SYNC_EVENT)));
}

/** React hook that subscribes to history changes and re-reads on every update. */
export function useWatchHistory(): HistoryEntry[] {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    const read = () => setHistory(getHistory());
    read(); // initial read on mount
    window.addEventListener(HISTORY_SYNC_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(HISTORY_SYNC_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  return history;
}
