// ProviderSelector — the server picker under the player, styled 1:1 after
// animex.one's original server card:
//
//   ┌───────────────────────────────────────────┐
//   │ ┌───────────────┬───────────────┐         │
//   │ │ [CC] Sub      │ [Mic] Dub     │         │  ← tabs in bg-black/40 pill
//   │ └───────────────┴───────────────┘         │
//   │ ANMX │ ZEN  │ KOTO│ Zoro                  │  ← grid-cols-4 gap-1
//   │ Yuki │ Loli │ Sora│ …                     │    active = white pill,
//   └───────────────────────────────────────────┘    inactive = bg-white/5
//
// Original classes mirrored from animex.one (Svelte + Tailwind theme):
//   card   → rounded-[8px] bg-[#0a0a0a] p-2.5 md:p-3
//   tabs   → rounded-[8px] border border-white/5 bg-black/40 p-1,
//            active bg-primary(near-white) text-primary-foreground
//   chips  → grid grid-cols-4 gap-1,
//            base  min-w-0 truncate rounded-[8px] px-1.5 py-1.5 text-center
//                  text-[11px] font-semibold transition-colors
//            active   bg-white text-zinc-900
//            inactive bg-white/5 text-white/70 hover:bg-white/10 hover:text-white
// Healthy chips look exactly like the original; only a dead (red) or
// still-resolving (yellow) server gets a tiny status dot.

import { Captions, Mic } from "lucide-react";

export interface ServerChip {
  /**
   * Stable key — either a stream identity (click plays that stream
   * directly), `animex:<serverId>` (click re-resolves that per-episode
   * server), or a provider family key like `allanime`/`zen`/`koto` (click
   * re-resolves the provider). The Watch page maps it back.
   */
  key: string;
  /** Server name exactly as it should read in the grid (Vidtower, Yuki, Zen…). */
  label: string;
  /** Optional tooltip, e.g. "Soft sub, Good, Multi quality" or quality/type. */
  tip?: string;
  /** Chip status — drives the status dot (only error/loading render one). */
  status?: "idle" | "loading" | "done" | "error";
}

interface ProviderSelectorProps {
  mode: "sub" | "dub";
  onModeChange: (m: "sub" | "dub") => void;
  /** Every server chip — resolved streams + retryable dead servers. */
  chips: ServerChip[];
  activeKey: string | null;
  onSelect: (key: string) => void;
  /** Servers fetch state for the current mode — dims the grid while loading. */
  serversLoading?: boolean;
}

export function ProviderSelector({
  mode,
  onModeChange,
  chips,
  activeKey,
  onSelect,
  serversLoading,
}: ProviderSelectorProps) {
  return (
    <div
      className="rounded-[8px] bg-[#0a0a0a] border border-white/5 p-2.5 md:p-3"
      data-testid="provider-selector"
    >
      {/* Sub / Dub segmented tabs — animex.one original */}
      <div className="mb-2 flex items-center gap-1 rounded-[8px] border border-white/5 bg-black/40 p-1">
        {(["sub", "dub"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              aria-pressed={active}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-[6px] px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                active
                  ? "bg-white text-zinc-900"
                  : "text-white/50 hover:bg-white/5 hover:text-white"
              }`}
            >
              {m === "sub" ? (
                <Captions className="h-3.5 w-3.5" />
              ) : (
                <Mic className="h-3.5 w-3.5" />
              )}
              {m}
            </button>
          );
        })}
      </div>

      {/* Servers grid — animex.one original: grid-cols-4 gap-1, compact 11px chips */}
      <div
        className={`grid grid-cols-4 gap-1 transition-opacity duration-200 ${
          serversLoading ? "opacity-60" : ""
        }`}
      >
        {chips.map((chip) => {
          const active = chip.key === activeKey;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onSelect(chip.key)}
              title={chip.tip ? `${chip.label} — ${chip.tip}` : chip.label}
              aria-pressed={active}
              className={`relative min-w-0 truncate rounded-[8px] px-1.5 py-1.5 text-center text-[11px] font-semibold transition-colors ${
                active
                  ? "bg-white text-zinc-900"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {chip.label}
              {/* Status dot — ONLY for a dead (red) or still-resolving
                  (yellow) server, so healthy chips match the original look */}
              {(chip.status === "error" || chip.status === "loading") && (
                <span
                  className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    chip.status === "loading"
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-red-500"
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
