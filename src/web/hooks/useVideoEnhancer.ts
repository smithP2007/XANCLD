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
 *
 * IMPORTANT: Only CSS-native filter functions are used (brightness, contrast,
 * saturate, hue-rotate, blur, sepia, grayscale). These are GPU-accelerated
 * by the browser's compositor and don't cause choppy playback.
 *
 * The SVG filter (url(#xan-enhancer) with feComponentTransfer + feConvolveMatrix)
 * is NOT used on the playing video because SVG filters are CPU-based and
 * can't keep up with real-time video frame decoding (24-60 fps).
 *
 * Gamma is approximated by adjusting brightness (gamma < 1 brightens midtones,
 * gamma > 1 darkens — similar effect to brightness adjustment).
 * Sharpen is approximated by a small contrast boost (true sharpen requires
 * an expensive convolution kernel that kills performance).
 */
export function buildEnhancerFilterCss(s: EnhancerState): string {
  if (!isEnhancerActive(s)) return "none";

  // ─── Combine brightness + gamma into a single brightness() call ───
  // gamma < 1 → brighter midtones → multiply brightness up
  // gamma > 1 → darker midtones → multiply brightness down
  let effectiveBrightness = s.brightness;
  if (Math.abs(s.gamma - 1.0) > 0.001) {
    // Approximate gamma: brightness *= (1 / gamma) for gamma < 1,
    // brightness *= (2 - gamma) for gamma > 1 (clamped)
    const gammaFactor = s.gamma < 1
      ? 1 / s.gamma  // gamma 0.5 → 2x brighter
      : Math.max(0.5, 2 - s.gamma);  // gamma 1.5 → 0.5x brightness
    effectiveBrightness = s.brightness * gammaFactor;
  }

  // ─── Combine contrast + sharpen into a single contrast() call ───
  // Sharpen is approximated by a small contrast boost (true sharpen
  // requires feConvolveMatrix which is too expensive for real-time video)
  let effectiveContrast = s.contrast;
  if (s.sharpen > 0) {
    // Scale sharpen (0-100) to contrast boost (0-15%)
    effectiveContrast = s.contrast + (s.sharpen / 100) * 15;
  }

  const parts: string[] = [];
  if (effectiveBrightness !== 100) {
    parts.push(`brightness(${(effectiveBrightness / 100).toFixed(3)})`);
  }
  if (effectiveContrast !== 100) {
    parts.push(`contrast(${(effectiveContrast / 100).toFixed(3)})`);
  }
  if (s.saturation !== 100) parts.push(`saturate(${(s.saturation / 100).toFixed(3)})`);
  if (s.hue !== 0) parts.push(`hue-rotate(${s.hue}deg)`);
  if (s.blur !== 0) parts.push(`blur(${s.blur.toFixed(2)}px)`);
  if (s.sepia !== 0) parts.push(`sepia(${(s.sepia / 100).toFixed(3)})`);
  if (s.grayscale !== 0) parts.push(`grayscale(${(s.grayscale / 100).toFixed(3)})`);

  return parts.length > 0 ? parts.join(" ") : "none";
}

// ─── Custom presets (user-saved, max 10) ──────────────────────
export interface CustomPreset {
  id: string;
  name: string;
  values: Omit<EnhancerState, "enabled">;
  createdAt: number;
}

export const MAX_CUSTOM_PRESETS = 10;
const CUSTOM_PRESETS_KEY = "xan-video-enhancer-presets";

function readCustomPresets(): CustomPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_CUSTOM_PRESETS);
  } catch {
    return [];
  }
}

function writeCustomPresets(presets: CustomPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets.slice(0, MAX_CUSTOM_PRESETS)));
    queueMicrotask(() => window.dispatchEvent(new CustomEvent(SYNC_EVENT)));
  } catch {
    // ignore
  }
}

// ─── Hook ─────────────────────────────────────────────────────
export function useVideoEnhancer() {
  const [state, setState] = useState<EnhancerState>(DEFAULT_ENHANCER);
  const [peeking, setPeeking] = useState(false);
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setState(readState());
    setCustomPresets(readCustomPresets());
  }, []);

  // Cross-instance sync (within same tab — the settings page and the player
  // both use this hook and need to stay in sync)
  useEffect(() => {
    const handler = () => {
      queueMicrotask(() => {
        setState(readState());
        setCustomPresets(readCustomPresets());
      });
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

  // ─── Detect which preset is currently applied ───
  // Checks if current state matches any built-in or custom preset
  const matchedPresetId = useMemo(() => {
    for (const [id, preset] of Object.entries(ENHANCER_PRESETS)) {
      const v = preset.values;
      if (
        state.brightness === v.brightness &&
        state.contrast === v.contrast &&
        state.saturation === v.saturation &&
        state.hue === v.hue &&
        state.blur === v.blur &&
        state.sepia === v.sepia &&
        state.grayscale === v.grayscale &&
        Math.abs(state.gamma - v.gamma) < 0.001 &&
        state.sharpen === v.sharpen
      ) {
        return id;
      }
    }
    return null;
  }, [state]);

  const matchedCustomPresetId = useMemo(() => {
    for (const cp of customPresets) {
      const v = cp.values;
      if (
        state.brightness === v.brightness &&
        state.contrast === v.contrast &&
        state.saturation === v.saturation &&
        state.hue === v.hue &&
        state.blur === v.blur &&
        state.sepia === v.sepia &&
        state.grayscale === v.grayscale &&
        Math.abs(state.gamma - v.gamma) < 0.001 &&
        state.sharpen === v.sharpen
      ) {
        return cp.id;
      }
    }
    return null;
  }, [state, customPresets]);

  // Clear peeking when enhancer is turned off
  useEffect(() => {
    if (!active) setPeeking(false);
  }, [active]);

  // effectiveFilterCss is what the <video>/<iframe> actually gets.
  // When peeking, suppress the filter (show original for comparison).
  const effectiveFilterCss = peeking && active ? "none" : filterCss;
  const effectiveActive = active && !peeking;

  // ─── Custom preset functions ───
  const saveCustomPreset = useCallback((name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const newPreset: CustomPreset = {
      id: `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed.slice(0, 24),
      values: {
        brightness: state.brightness,
        contrast: state.contrast,
        saturation: state.saturation,
        hue: state.hue,
        blur: state.blur,
        sepia: state.sepia,
        grayscale: state.grayscale,
        gamma: state.gamma,
        sharpen: state.sharpen,
      },
      createdAt: Date.now(),
    };
    let savedId: string | null = null;
    setCustomPresets((prev) => {
      if (prev.length >= MAX_CUSTOM_PRESETS) return prev;
      const next = [...prev, newPreset];
      writeCustomPresets(next);
      savedId = newPreset.id;
      return next;
    });
    return savedId;
  }, [state]);

  const applyCustomPreset = useCallback((id: string) => {
    setCustomPresets((prevList) => {
      const found = prevList.find((p) => p.id === id);
      if (found) {
        setState((prev) => {
          const next: EnhancerState = { ...found.values, enabled: true };
          writeState(next);
          return next;
        });
      }
      return prevList;
    });
  }, []);

  const deleteCustomPreset = useCallback((id: string) => {
    setCustomPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      writeCustomPresets(next);
      return next;
    });
  }, []);

  return {
    state,
    update,
    updateMany,
    applyPreset,
    reset,
    toggleEnabled,
    filterCss: effectiveFilterCss,
    active: effectiveActive,
    rawState: state,
    rawActive: active,
    peeking,
    peekStart,
    peekEnd,
    // Custom presets
    customPresets,
    saveCustomPreset,
    applyCustomPreset,
    deleteCustomPreset,
    canSaveMoreCustom: customPresets.length < MAX_CUSTOM_PRESETS,
    // Currently matched preset (for highlighting)
    matchedPresetId,
    matchedCustomPresetId,
  };
}
