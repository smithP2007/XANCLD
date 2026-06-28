import { useState, useEffect, useCallback } from "react";

export interface XanSettings {
  theme: "dark" | "light";
  autoplay: boolean;
  skipIntro: boolean;
  defaultMode: "sub" | "dub";
  volume: number;
  playbackRate: number;
}

const DEFAULTS: XanSettings = {
  theme: "dark",
  autoplay: true,
  skipIntro: true,
  defaultMode: "sub",
  volume: 80,
  playbackRate: 1,
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
}

export function applyTheme(theme: "dark" | "light"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "light") {
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
}

export function useSettings(): [XanSettings, (updates: Partial<XanSettings>) => void] {
  const [settings, setSettings] = useState<XanSettings>(currentSettings);

  useEffect(() => {
    // Load from localStorage on mount
    currentSettings = loadSettings();
    setSettings(currentSettings);
    applyTheme(currentSettings.theme);

    const unsub = (s: XanSettings) => setSettings(s);
    subscribers.add(unsub);
    return () => {
      subscribers.delete(unsub);
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
  } catch {
    // ignore
  }
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}
