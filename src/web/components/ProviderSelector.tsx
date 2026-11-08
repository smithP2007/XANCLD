// ProviderSelector — the animex.one-style server picker that sits right
// under the player. ONE grid holds EVERYTHING, named by server only:
//
//   ┌───────────────────────────────────────────┐
//   │  [CC] Sub            │  [Mic] Dub         │   ← segmented Sub/Dub tabs
//   ├───────────────────────────────────────────┤
//   │ SERVERS                            7      │
//   │ Vidtower │ Mp4  │ Ok  │ Yuki              │
//   │ Loli     │ Zen  │ Koto│ …                 │   ← every server, one chip each
//   └───────────────────────────────────────────┘
//
// Every stream any provider resolves shows up as ONE chip named after its
// server — exactly like animex.one's servers grid. No separate "Sources"
// cards row, no provider-family rows: a resolved stream IS a server chip
// (click = play instantly); a server whose upstream died stays in the grid
// with a red dot (click = retry that server); a provider that produced
// nothing yet shows its family chip (ANMX/ZEN/KOTO) until its real
// server-named chips arrive.

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
  /** Chip status — drives the little status dot. */
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
      className="glass rounded-2xl p-3 space-y-2.5"
      data-testid="provider-selector"
    >
      {/* Sub / Dub segmented tabs */}
      <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-black/40 border border-xan-border/60">
        {(["sub", "dub"] as const).map((m) => {
          const active = mode === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              aria-pressed={active}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold capitalize transition-all duration-200 ${
                active
                  ? "bg-white text-zinc-900 shadow-md"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              {m === "sub" ? (
                <Captions className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
              {m}
            </button>
          );
        })}
      </div>

      {/* Servers grid — ONE server-named grid for every resolved stream */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
            Servers
          </span>
          <span className="text-[10px] text-muted-foreground/50">{chips.length}</span>
        </div>
        <div
          className={`grid grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-1 no-scrollbar transition-opacity duration-200 ${
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
                className={`relative flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all duration-200 truncate ${
                  active
                    ? "bg-white text-zinc-900 shadow-md"
                    : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="truncate">{chip.label}</span>
                {/* Load status dot: green = streaming, yellow = resolving,
                    red = this server's upstream is dead (click = retry) */}
                {chip.status && chip.status !== "idle" && (
                  <span
                    className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                      chip.status === "done"
                        ? "bg-green-500"
                        : chip.status === "loading"
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

      <p className="text-center text-[10px] text-muted-foreground/60">
        Servers resolve fresh per episode — availability changes per episode, just like on AnimeX.
      </p>
    </div>
  );
}
