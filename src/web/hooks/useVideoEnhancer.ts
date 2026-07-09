import { useState, useEffect, useCallback, useMemo } from "react";

// ─── Types ────────────────────────────────────────────────────
export interface EnhancerState {
  /** Master on/off — when false, no filter is applied (even if values are non-default). */
  enabled: boolean;
  // CSS-filter controls (0–200, 100 = neutral)
  brightness: number;
  contrast: number;
  saturation: number;
  // CSS-filter controls (angle)
  hue: number; // -180 to 180, 0 = neutral
  // CSS-filter controls (other)
  blur: number; // 0–10 px, 0 = neutral
  sepia: number; // 0–100 %, 0 = neutral
  grayscale: number; // 0–100 %, 0 = neutral
  // SVG-filter controls (require url(#xan-enhancer))
  gamma: number; // 0.2–3.0, 1.0 = neutral
  sharpen: number; // 0–100, 0 = neutral
}

export const DEFAULT_ENHANCER: EnhancerState = {
  enabled: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  blur: 0,
  sepia: 0,
  grayscale: 0,
  gamma: 1.0,
  sharpen: 0,
};

// ─── Built-in presets (20 curated looks) ──────────────────────
export const ENHANCER_PRESETS: Record<string, { label: string; values: Omit<EnhancerState, "enabled"> }> = {
  original:       { label: "Original",     values: { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.0, sharpen: 0 } },
  vivid:          { label: "Vivid",        values: { brightness: 105, contrast: 115, saturation: 140, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.0, sharpen: 20 } },
  vivid_plus:     { label: "Vivid+",       values: { brightness: 108, contrast: 120, saturation: 160, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.0, sharpen: 30 } },
  vivid_max:      { label: "Vivid Max",    values: { brightness: 110, contrast: 125, saturation: 180, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.05, sharpen: 40 } },
  neon:           { label: "Neon",         values: { brightness: 108, contrast: 125, saturation: 170, hue: 15, blur: 0, sepia: 0, grayscale: 0, gamma: 1.0, sharpen: 35 } },
  pastel:         { label: "Pastel",       values: { brightness: 110, contrast: 95, saturation: 120, hue: 0, blur: 0.5, sepia: 0, grayscale: 0, gamma: 0.95, sharpen: 0 } },
  color_boost:    { label: "Color Boost",  values: { brightness: 105, contrast: 110, saturation: 150, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.0, sharpen: 15 } },
  bright_boost:   { label: "Bright Boost", values: { brightness: 130, contrast: 105, saturation: 110, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.05, sharpen: 10 } },
  contrast_boost: { label: "Contrast Boost", values: { brightness: 100, contrast: 140, saturation: 105, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.0, sharpen: 20 } },
  sharp_boost:    { label: "Sharp Boost",  values: { brightness: 100, contrast: 110, saturation: 110, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.0, sharpen: 75 } },
  anime_boost:    { label: "Anime Boost+", values: { brightness: 108, contrast: 125, saturation: 175, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.05, sharpen: 45 } },
  hdr_boost:      { label: "HDR Boost",    values: { brightness: 108, contrast: 120, saturation: 130, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.1, sharpen: 25 } },
  cinema:         { label: "Cinema",       values: { brightness: 95, contrast: 110, saturation: 90, hue: 0, blur: 0, sepia: 8, grayscale: 0, gamma: 0.95, sharpen: 10 } },
  warm:           { label: "Warm",         values: { brightness: 105, contrast: 105, saturation: 115, hue: 10, blur: 0, sepia: 25, grayscale: 0, gamma: 1.0, sharpen: 10 } },
  cool:           { label: "Cool",         values: { brightness: 100, contrast: 110, saturation: 110, hue: -15, blur: 0, sepia: 0, grayscale: 0, gamma: 1.0, sharpen: 10 } },
  vintage:        { label: "Vintage",      values: { brightness: 105, contrast: 95, saturation: 80, hue: 0, blur: 0, sepia: 40, grayscale: 0, gamma: 0.95, sharpen: 5 } },
  anime:          { label: "Anime Boost",  values: { brightness: 105, contrast: 120, saturation: 160, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.05, sharpen: 35 } },
  soft:           { label: "Soft",         values: { brightness: 105, contrast: 95, saturation: 95, hue: 0, blur: 1.0, sepia: 0, grayscale: 0, gamma: 1.0, sharpen: 0 } },
  sharp:          { label: "Sharp",        values: { brightness: 100, contrast: 110, saturation: 110, hue: 0, blur: 0, sepia: 0, grayscale: 0, gamma: 1.0, sharpen: 55 } },
  mono:           { label: "Mono",         values: { brightness: 105, contrast: 115, saturation: 100, hue: 0, blur: 0, sepia: 0, grayscale: 100, gamma: 1.0, sharpen: 15 } },
};

const STORAGE_KEY = "xan-video-enhancer";
const SYNC_EVENT = "xan-enhancer-sync";

function readState(): EnhancerState {
  if (typeof window === "undefined") return DEFAULT_ENHANCER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ENHANCER;
    return { ...DEFAULT_ENHANCER, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ENHANCER;
  }
}

function writeState(s: EnhancerState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    queueMicrotask(() => window.dispatchEvent(new CustomEvent(SYNC_EVENT)));
  } catch {
    // ignore
  }
}

// ─── Public helpers ───────────────────────────────────────────
export function isEnhancerActive(s: EnhancerState): boolean {
  if (!s.enabled) return false;
  return (
    s.brightness !== 100 ||
    s.contrast !== 100 ||
    s.saturation !== 100 ||
    s.hue !== 0 ||
    s.blur !== 0 ||
    s.sepia !== 0 ||
    s.grayscale !== 0 ||
    Math.abs(s.gamma - 1.0) > 0.001 ||
    s.sharpen !== 0
  );
}

/**
 * Build the CSS `filter` string for the <video> / <iframe> element.
 * Returns "none" when inactive. Appends `url(#xan-enhancer)` when gamma or
 * sharpen is non-default (they need the SVG filter).
 */
export function buildEnhancerFilterCss(s: EnhancerState): string {
  if (!isEnhancerActive(s)) return "none";
  const parts: string[] = [];
  if (s.brightness !== 100) parts.push(`brightness(${(s.brightness / 100).toFixed(3)})`);
  if (s.contrast !== 100) parts.push(`contrast(${(s.contrast / 100).toFixed(3)})`);
  if (s.saturation !== 100) parts.push(`saturate(${(s.saturation / 100).toFixed(3)})`);
  if (s.hue !== 0) parts.push(`hue-rotate(${s.hue}deg)`);
  if (s.blur !== 0) parts.push(`blur(${s.blur.toFixed(2)}px)`);
  if (s.sepia !== 0) parts.push(`sepia(${(s.sepia / 100).toFixed(3)})`);
  if (s.grayscale !== 0) parts.push(`grayscale(${(s.grayscale / 100).toFixed(3)})`);
  if (Math.abs(s.gamma - 1.0) > 0.001 || s.sharpen !== 0) {
    parts.push("url(#xan-enhancer)");
  }
  return parts.length > 0 ? parts.join(" ") : "none";
}

// ─── Hook ─────────────────────────────────────────────────────
export function useVideoEnhancer() {
  const [state, setState] = useState<EnhancerState>(DEFAULT_ENHANCER);
  const [peeking, setPeeking] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setState(readState());
  }, []);

  // Cross-instance sync (within same tab — the settings page and the player
  // both use this hook and need to stay in sync)
  useEffect(() => {
    const handler = () => {
      queueMicrotask(() => setState(readState()));
    };
    window.addEventListener(SYNC_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(SYNC_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = useCallback(<K extends keyof EnhancerState>(key: K, value: EnhancerState[K]) => {
    setState((prev) => {
      const next = { ...prev, [key]: value };
      writeState(next);
      return next;
    });
  }, []);

  const updateMany = useCallback((partial: Partial<EnhancerState>) => {
    setState((prev) => {
      const next = { ...prev, ...partial };
      writeState(next);
      return next;
    });
  }, []);

  const applyPreset = useCallback((presetId: keyof typeof ENHANCER_PRESETS) => {
    const preset = ENHANCER_PRESETS[presetId];
    if (!preset) return;
    const next: EnhancerState = { ...preset.values, enabled: true };
    setState(next);
    writeState(next);
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_ENHANCER);
    writeState(DEFAULT_ENHANCER);
  }, []);

  const toggleEnabled = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, enabled: !prev.enabled };
      writeState(next);
      return next;
    });
  }, []);

  // Peek mode — temporary bypass to compare before/after
  const peekStart = useCallback(() => setPeeking(true), []);
  const peekEnd = useCallback(() => setPeeking(false), []);

  const filterCss = useMemo(() => buildEnhancerFilterCss(state), [state]);
  const active = useMemo(() => isEnhancerActive(state), [state]);

  // Clear peeking when enhancer is turned off
  useEffect(() => {
    if (!active) setPeeking(false);
  }, [active]);

  // effectiveFilterCss is what the <video>/<iframe> actually gets.
  // When peeking, suppress the filter (show original for comparison).
  const effectiveFilterCss = peeking && active ? "none" : filterCss;
  const effectiveActive = active && !peeking;

  return {
    state,
    update,
    updateMany,
    applyPreset,
    reset,
    toggleEnabled,
    filterCss: effectiveFilterCss,
    active: effectiveActive,
    // Raw (non-peeked) state for the SVG defs — keeps the SVG mounted while peeking
    rawState: state,
    rawActive: active,
    peeking,
    peekStart,
    peekEnd,
  };
}
