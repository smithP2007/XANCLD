import { Check } from "lucide-react";
import {
  THEME_PRESETS,
  type ThemePreset,
} from "../hooks/useSettings";

interface Props {
  current: ThemePreset;
  onSelect: (preset: ThemePreset) => void;
}

/**
 * ThemePicker — visual preset selector for Settings > Appearance.
 *
 * Per the redesign plan §6: list of available themes with preview swatches,
 * onSelect handler. Renders a 2-column grid of preset cards on mobile, single
 * row on desktop. Disabled when active color-scheme is "light" or "system"
 * (since presets only apply in dark mode — see useSettings.applyTheme).
 */
export function ThemePicker({ current, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
      {THEME_PRESETS.map((preset) => {
        const active = preset.id === current;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => onSelect(preset.id)}
            aria-pressed={active}
            aria-label={`Select ${preset.label} theme`}
            className={`group relative rounded-xl border p-3 text-left transition-all ${
              active
                ? "border-xan-crimson/60 bg-xan-crimson/10 shadow-[0_0_0_1px_rgba(233,69,96,0.3)]"
                : "border-xan-border bg-xan-card hover:border-xan-crimson/40 hover:bg-xan-card-hover"
            }`}
          >
            {/* Swatch — two color chips + background preview */}
            <div className="flex items-center gap-1.5 mb-2.5">
              <div
                className="w-5 h-5 rounded-full border border-white/10"
                style={{ background: preset.swatch[0] }}
              />
              <div
                className="w-5 h-5 rounded-full border border-white/10"
                style={{ background: preset.swatch[1] }}
              />
              <div
                className="ml-auto w-5 h-5 rounded-md border border-white/10"
                style={{ background: "var(--background)" }}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground truncate">
                {preset.label}
              </span>
              {active && <Check className="h-3.5 w-3.5 text-xan-crimson flex-shrink-0" />}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">
              {preset.desc}
            </p>
          </button>
        );
      })}
    </div>
  );
}
