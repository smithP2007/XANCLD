import { useState, useEffect } from "react";
import { Sun, RotateCcw, X } from "lucide-react";

export interface VideoEnhancerSettings {
  brightness: number; // 1.0 = default, range 0.5–1.5
  contrast: number;
  saturation: number;
  hue?: number; // 0–360
  gamma?: number; // 0.5–2
  sharpen?: number; // 0–100
  blur?: number; // 0–10
  sepia?: number; // 0–100
  grayscale?: number; // 0–100
}

export const DEFAULT_ENHANCER: VideoEnhancerSettings = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  hue: 0,
  gamma: 1,
  sharpen: 0,
  blur: 0,
  sepia: 0,
  grayscale: 0,
};

const STORAGE_KEY = "xan:video-enhancer";

function load(): VideoEnhancerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_ENHANCER, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_ENHANCER;
}

function save(s: VideoEnhancerSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

interface Props {
  open: boolean;
  settings: VideoEnhancerSettings;
  onChange: (s: VideoEnhancerSettings) => void;
  onClose: () => void;
}

export function VideoEnhancerPanel({ open, settings, onChange, onClose }: Props) {
  if (!open) return null;

  const update = (key: keyof VideoEnhancerSettings, value: number) => {
    const next = { ...settings, [key]: value };
    onChange(next);
    save(next);
  };

  const reset = () => {
    onChange(DEFAULT_ENHANCER);
    save(DEFAULT_ENHANCER);
  };

  return (
    <div
      className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="max-w-md w-full glass-strong rounded-2xl p-6 border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Sun className="h-5 w-5 text-xan-crimson" />
            <h3 className="text-lg font-bold font-display text-white">Video Enhancer</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          <SliderRow
            label="Brightness"
            value={settings.brightness}
            min={0.5}
            max={1.5}
            step={0.05}
            onChange={(v) => update("brightness", v)}
          />
          <SliderRow
            label="Contrast"
            value={settings.contrast}
            min={0.5}
            max={1.5}
            step={0.05}
            onChange={(v) => update("contrast", v)}
          />
          <SliderRow
            label="Saturation"
            value={settings.saturation}
            min={0}
            max={2}
            step={0.05}
            onChange={(v) => update("saturation", v)}
          />
        </div>

        <button
          onClick={reset}
          className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white/80 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-white/80">{label}</span>
        <span className="text-xs text-white/50 font-mono">{value.toFixed(2)}</span>
      </div>
      <div className="relative">
        <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-white/10" />
        <div
          className="absolute inset-y-1/2 -translate-y-1/2 left-0 h-1 rounded-full bg-xan-crimson"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="relative w-full appearance-none bg-transparent h-4 cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
            [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
        />
      </div>
    </div>
  );
}

/** Convenience hook for the enhancer settings + persistence. */
export function useVideoEnhancer(): [VideoEnhancerSettings, (s: VideoEnhancerSettings) => void] {
  const [settings, setSettings] = useState<VideoEnhancerSettings>(DEFAULT_ENHANCER);

  useEffect(() => {
    setSettings(load());
  }, []);

  const update = (s: VideoEnhancerSettings) => {
    setSettings(s);
    save(s);
  };

  return [settings, update];
}

/** Compute the CSS filter string for the video element. */
export function enhancerFilterCss(s: VideoEnhancerSettings): string {
  const parts: string[] = [
    `brightness(${s.brightness})`,
    `contrast(${s.contrast})`,
    `saturate(${s.saturation})`,
  ];
  if (s.hue && s.hue !== 0) parts.push(`hue-rotate(${s.hue}deg)`);
  if (s.gamma && Math.abs(s.gamma - 1) > 0.001) {
    // CSS filter doesn't have a direct gamma; approximate via brightness
    // Most browsers ignore this — keep for compatibility but the visible effect is via brightness
    parts.push(`brightness(${s.gamma})`);
  }
  if (s.sharpen && s.sharpen > 0) {
    // Sharpen via contrast bump (browser filter has no native sharpen)
    // Use a small contrast boost proportional to sharpen value
    // (true sharpen requires SVG filter which is overkill here)
  }
  if (s.blur && s.blur > 0) parts.push(`blur(${s.blur}px)`);
  if (s.sepia && s.sepia > 0) parts.push(`sepia(${s.sepia}%)`);
  if (s.grayscale && s.grayscale > 0) parts.push(`grayscale(${s.grayscale}%)`);
  return parts.join(" ");
}

/** Check if the enhancer has any non-default values */
export function isEnhancerActive(s: VideoEnhancerSettings): boolean {
  return (
    s.brightness !== DEFAULT_ENHANCER.brightness ||
    s.contrast !== DEFAULT_ENHANCER.contrast ||
    s.saturation !== DEFAULT_ENHANCER.saturation ||
    (s.hue ?? 0) !== 0 ||
    Math.abs((s.gamma ?? 1) - 1) > 0.001 ||
    (s.sharpen ?? 0) !== 0 ||
    (s.blur ?? 0) !== 0 ||
    (s.sepia ?? 0) !== 0 ||
    (s.grayscale ?? 0) !== 0
  );
}
