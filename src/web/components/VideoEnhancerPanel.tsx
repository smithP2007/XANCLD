import { useState } from "react";
import {
  Sun,
  RotateCcw,
  X,
  Power,
  Eye,
  EyeOff,
  Sparkles,
  Contrast,
  Palette,
  Droplet,
  Ghost,
  TrendingUp,
  CircleDashed,
  Rainbow,
  Wand2,
} from "lucide-react";
import {
  useVideoEnhancer,
  ENHANCER_PRESETS,
  type EnhancerState,
} from "../hooks/useVideoEnhancer";

interface Props {
  open: boolean;
  onClose: () => void;
}

// Slider config: min/max/step/unit for each control
const SLIDERS: {
  key: keyof EnhancerState;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  min: number;
  max: number;
  step: number;
  neutral: number;
  unit?: string;
}[] = [
  { key: "brightness", label: "Brightness", icon: Sun, min: 0, max: 200, step: 1, neutral: 100, unit: "%" },
  { key: "contrast", label: "Contrast", icon: Contrast, min: 0, max: 200, step: 1, neutral: 100, unit: "%" },
  { key: "saturation", label: "Saturation", icon: Palette, min: 0, max: 200, step: 1, neutral: 100, unit: "%" },
  { key: "hue", label: "Hue", icon: Rainbow, min: -180, max: 180, step: 5, neutral: 0, unit: "°" },
  { key: "blur", label: "Blur", icon: CircleDashed, min: 0, max: 10, step: 0.5, neutral: 0, unit: "px" },
  { key: "sepia", label: "Sepia", icon: Droplet, min: 0, max: 100, step: 5, neutral: 0, unit: "%" },
  { key: "grayscale", label: "Grayscale", icon: Ghost, min: 0, max: 100, step: 5, neutral: 0, unit: "%" },
  { key: "gamma", label: "Gamma", icon: TrendingUp, min: 0.2, max: 3.0, step: 0.05, neutral: 1.0 },
  { key: "sharpen", label: "Sharpen", icon: Sparkles, min: 0, max: 100, step: 5, neutral: 0, unit: "%" },
];

export function VideoEnhancerPanel({ open, onClose }: Props) {
  const enhancer = useVideoEnhancer();
  const [showPresets, setShowPresets] = useState(true);

  if (!open) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full max-h-[90vh] overflow-y-auto glass-strong rounded-2xl p-5 border border-white/10"
        onClick={handleClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-xan-crimson" />
            <h3 className="text-lg font-bold font-display text-white">Video Enhancer</h3>
            {enhancer.active && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/30">
                ACTIVE
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Peek button (hold to compare) */}
            <button
              onMouseDown={enhancer.peekStart}
              onMouseUp={enhancer.peekEnd}
              onMouseLeave={enhancer.peekEnd}
              onTouchStart={enhancer.peekStart}
              onTouchEnd={enhancer.peekEnd}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass border border-white/15 text-white/80 hover:bg-white/10 transition-colors"
              title="Hold to peek at original (no filter)"
            >
              {enhancer.peeking ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {enhancer.peeking ? "Peeking" : "Hold to Compare"}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Master on/off + reset row */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
          <button
            onClick={enhancer.toggleEnabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              enhancer.state.enabled
                ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white shadow-lg shadow-xan-crimson/20"
                : "glass text-white/70 hover:text-white border border-white/15"
            }`}
          >
            <Power className="h-4 w-4" />
            {enhancer.state.enabled ? "Enhancer ON" : "Enhancer OFF"}
          </button>
          <button
            onClick={enhancer.reset}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium glass border border-white/15 text-white/70 hover:text-white transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            onClick={() => setShowPresets((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium glass border border-white/15 text-white/70 hover:text-white transition-colors ml-auto"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {showPresets ? "Hide" : "Show"} Presets
          </button>
        </div>

        {/* Presets grid */}
        {showPresets && (
          <div className="mb-4 pb-4 border-b border-white/10">
            <p className="text-xs uppercase tracking-wider text-white/50 font-semibold mb-2">Presets</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
              {Object.entries(ENHANCER_PRESETS).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => enhancer.applyPreset(id as keyof typeof ENHANCER_PRESETS)}
                  className="px-2 py-2 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 hover:border-xan-crimson/40 hover:bg-white/10 text-white/80 hover:text-white transition-all"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Manual sliders */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-white/50 font-semibold">Manual Controls</p>
          {SLIDERS.map((slider) => {
            const value = enhancer.state[slider.key] as number;
            const isDefault = Math.abs(value - slider.neutral) < 0.001;
            const pct = ((value - slider.min) / (slider.max - slider.min)) * 100;
            const display = slider.unit === "°" || slider.unit === "%"
              ? Math.round(value)
              : slider.key === "gamma"
                ? value.toFixed(2)
                : value;
            return (
              <div
                key={slider.key}
                className={`transition-opacity ${enhancer.state.enabled ? "" : "opacity-40 pointer-events-none"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2 text-sm text-white/80">
                    <slider.icon className="h-3.5 w-3.5" />
                    {slider.label}
                  </span>
                  <span className={`text-xs font-mono ${isDefault ? "text-white/40" : "text-xan-crimson"}`}>
                    {display}{slider.unit}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-white/10" />
                  <div
                    className="absolute inset-y-1/2 -translate-y-1/2 left-0 h-1 rounded-full bg-xan-crimson"
                    style={{ width: `${pct}%` }}
                  />
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step}
                    value={value}
                    onChange={(e) => enhancer.update(slider.key, parseFloat(e.target.value) as never)}
                    className="relative w-full appearance-none bg-transparent h-4 cursor-pointer
                      [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                      [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
                      [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full
                      [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-[10px] text-white/40 text-center">
          Press <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 border border-white/20 text-white">E</kbd> while watching to toggle • Changes apply to both video and iframe players
        </p>
      </div>
    </div>
  );
}
