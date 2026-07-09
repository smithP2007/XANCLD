import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["Space", "K"], action: "Play / Pause" },
  { keys: ["J"], action: "Rewind 10s" },
  { keys: ["L"], action: "Forward 10s" },
  { keys: ["←"], action: "Rewind 5s" },
  { keys: ["→"], action: "Forward 5s" },
  { keys: ["↑"], action: "Volume up" },
  { keys: ["↓"], action: "Volume down" },
  { keys: ["M"], action: "Mute / Unmute" },
  { keys: ["F"], action: "Fullscreen" },
  { keys: ["0–9"], action: "Seek to 0%–90%" },
  { keys: ["E"], action: "Toggle video enhancer" },
  { keys: ["N"], action: "Next episode" },
  { keys: ["P"], action: "Previous episode" },
  { keys: ["?"], action: "Show / hide this overlay" },
];

export function KeyboardShortcutsOverlay({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-40 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="max-w-2xl w-full glass-strong rounded-2xl p-6 border border-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold font-display text-white">Keyboard Shortcuts</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/10 text-white/70 hover:text-white flex items-center justify-center"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          {SHORTCUTS.map((s, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0"
            >
              <span className="text-sm text-white/70">{s.action}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 border border-white/20 text-white"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-white/40 text-center">
          Press <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/10 border border-white/20 text-white">?</kbd> anytime to toggle this overlay
        </p>
      </div>
    </div>
  );
}
