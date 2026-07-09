import { useState } from "react";
import {
  Sun,
  RotateCcw,
  X,
  Power,
  Sparkles,
  Contrast,
  Palette,
  Droplet,
  Ghost,
  TrendingUp,
  CircleDashed,
  Rainbow,
  Wand2,
  Save,
  Trash2,
  ChevronDown,
  Bookmark,
  Plus,
} from "lucide-react";
import {
  useVideoEnhancer,
  ENHANCER_PRESETS,
  MAX_CUSTOM_PRESETS,
  type EnhancerState,
} from "../hooks/useVideoEnhancer";

interface Props {
  open: boolean;
  onClose: () => void;
}

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
  const [showManual, setShowManual] = useState(false);
  const [showCustomPresets, setShowCustomPresets] = useState(false);
  const [presetName, setPresetName] = useState("");

  if (!open) return null;

  const handleClick = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <div
      className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-3 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md max-h-[80vh] sm:max-h-[85vh] overflow-y-auto glass-strong rounded-t-2xl sm:rounded-2xl p-3 sm:p-4 border border-white/10 no-scrollbar"
        onClick={handleClick}
      >
        {/* Header — compact */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-xan-crimson" />
            <h3 className="text-sm font-bold font-display text-white">Enhancer</h3>
            {enhancer.active && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/30">
                ON
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Power + Reset row — compact */}
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={enhancer.toggleEnabled}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              enhancer.state.enabled
                ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white"
                : "glass text-white/70 border border-white/15"
            }`}
          >
            <Power className="h-3.5 w-3.5" />
            {enhancer.state.enabled ? "ON" : "OFF"}
          </button>
          <button
            onClick={enhancer.reset}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium glass border border-white/15 text-white/70 hover:text-white transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>

        {/* Built-in presets — compact grid */}
        <p className="text-[10px] uppercase tracking-wider text-white/50 font-semibold mb-1.5">Presets</p>
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-1 mb-3">
          {Object.entries(ENHANCER_PRESETS).map(([id, preset]) => (
            <button
              key={id}
              onClick={() => enhancer.applyPreset(id as keyof typeof ENHANCER_PRESETS)}
              className="px-1 py-1.5 rounded-md text-[10px] font-medium bg-white/5 border border-white/10 hover:border-xan-crimson/40 hover:bg-white/10 text-white/80 hover:text-white transition-all"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Custom presets — collapsible */}
        <button
          onClick={() => setShowCustomPresets((v) => !v)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] uppercase tracking-wider text-white/50 font-semibold hover:text-white/70 transition-colors mb-1"
        >
          <span className="flex items-center gap-1.5">
            <Bookmark className="h-3 w-3" />
            My Presets ({enhancer.customPresets.length}/{MAX_CUSTOM_PRESETS})
          </span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showCustomPresets ? "rotate-180" : ""}`} />
        </button>
        {showCustomPresets && (
          <div className="mb-3 space-y-1.5">
            {/* Save form */}
            {enhancer.canSaveMoreCustom ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && presetName.trim()) {
                      enhancer.saveCustomPreset(presetName);
                      setPresetName("");
                    }
                  }}
                  placeholder="Preset name..."
                  maxLength={24}
                  className="flex-1 h-8 px-2 rounded-md bg-white/5 border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-xan-crimson/40"
                />
                <button
                  onClick={() => {
                    if (presetName.trim()) {
                      enhancer.saveCustomPreset(presetName);
                      setPresetName("");
                    }
                  }}
                  className="flex items-center gap-1 px-2 h-8 rounded-md bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/30 text-xs font-medium hover:bg-xan-crimson/30 transition-colors"
                >
                  <Save className="h-3 w-3" />
                  Save
                </button>
              </div>
            ) : (
              <p className="text-[10px] text-white/40 text-center py-1">Max {MAX_CUSTOM_PRESETS} presets reached</p>
            )}
            {/* Saved presets list */}
            {enhancer.customPresets.length > 0 ? (
              <div className="space-y-1">
                {enhancer.customPresets.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 border border-white/10 group"
                  >
                    <button
                      onClick={() => enhancer.applyCustomPreset(cp.id)}
                      className="flex-1 text-left text-xs text-white/80 hover:text-white font-medium transition-colors"
                    >
                      {cp.name}
                    </button>
                    <button
                      onClick={() => enhancer.deleteCustomPreset(cp.id)}
                      className="opacity-0 group-hover:opacity-100 text-white/40 hover:text-red-400 transition-all p-0.5"
                      aria-label="Delete preset"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-white/30 text-center py-1">No saved presets yet</p>
            )}
          </div>
        )}

        {/* Manual controls — collapsible dropdown */}
        <button
          onClick={() => setShowManual((v) => !v)}
          className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-[10px] uppercase tracking-wider text-white/50 font-semibold hover:text-white/70 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Sliders className="h-3 w-3" />
            Manual Controls
          </span>
          <ChevronDown className={`h-3 w-3 transition-transform ${showManual ? "rotate-180" : ""}`} />
        </button>
        {showManual && (
          <div className="space-y-2 mt-2">
            {SLIDERS.map((slider) => {
              const value = enhancer.state[slider.key] as number;
              const isDefault = Math.abs(value - slider.neutral) < 0.001;
              const pct = ((value - slider.min) / (slider.max - slider.min)) * 100;
              const display = slider.unit === "°" || slider.unit === "%"
                ? Math.round(value)
                : value.toFixed(2);
              return (
                <div
                  key={slider.key}
                  className={`transition-opacity ${enhancer.state.enabled ? "" : "opacity-40 pointer-events-none"}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="flex items-center gap-1.5 text-[11px] text-white/80">
                      <slider.icon className="h-3 w-3" />
                      {slider.label}
                    </span>
                    <span className={`text-[10px] font-mono ${isDefault ? "text-white/40" : "text-xan-crimson"}`}>
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
                      className="relative w-full appearance-none bg-transparent h-3 cursor-pointer
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
                        [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full
                        [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer hint */}
        <p className="mt-3 text-center text-[9px] text-white/30">
          Press <kbd className="px-1 py-0.5 rounded text-[9px] font-mono bg-white/10 border border-white/20">E</kbd> to toggle
        </p>
      </div>
    </div>
  );
}

// Inline Sliders icon (avoid extra import)
function Sliders({ className }: { className?: string }) {
  return <Sparkles className={className} />;
}
