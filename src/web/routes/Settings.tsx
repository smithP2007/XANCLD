import {
  Palette,
  Play,
  Volume2,
  Compass,
  Database,
  Info,
  Sun,
  Moon,
  Trash2,
  Github,
  Cloud,
  Check,
} from "lucide-react";
import { useSettings, clearHistory } from "../hooks/useSettings";

export function Settings() {
  const [settings, update] = useSettings();

  const clearHistoryAction = () => {
    if (confirm("Clear all watch history? This cannot be undone.")) {
      clearHistory();
      alert("History cleared.");
    }
  };

  const clearCache = () => {
    if (confirm("Clear all cached data? This will reset settings to defaults.")) {
      localStorage.clear();
      location.reload();
    }
  };

  const sections = [
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "playback", label: "Playback", icon: Play },
    { id: "audio", label: "Audio & Subtitles", icon: Volume2 },
    { id: "content", label: "Content & Discovery", icon: Compass },
    { id: "data", label: "Data & Privacy", icon: Database },
    { id: "about", label: "About", icon: Info },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center glow-crimson">
          <Palette className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Customize your XAN experience</p>
        </div>
      </div>

      {/* Section nav chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-xan-card border border-xan-border hover:border-xan-crimson/40 hover:bg-xan-card-hover text-sm font-medium text-muted-foreground hover:text-foreground transition-all whitespace-nowrap"
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </a>
        ))}
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <Section id="appearance" icon={Palette} title="Appearance" desc="Customize how XAN looks">
          <Row label="Theme" desc="Choose your preferred color scheme — applies instantly">
            <div className="flex gap-2">
              <button
                onClick={() => update({ theme: "dark" })}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  settings.theme === "dark"
                    ? "bg-xan-crimson/20 border-xan-crimson/50 text-foreground"
                    : "bg-xan-card border-xan-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="h-4 w-4" /> Dark
              </button>
              <button
                onClick={() => update({ theme: "light" })}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                  settings.theme === "light"
                    ? "bg-xan-crimson/20 border-xan-crimson/50 text-foreground"
                    : "bg-xan-card border-xan-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="h-4 w-4" /> Light
              </button>
            </div>
          </Row>
        </Section>

        {/* Playback */}
        <Section id="playback" icon={Play} title="Playback" desc="Control video playback behavior">
          <Row label="Autoplay next episode" desc="Automatically play the next episode when current ends">
            <Toggle checked={settings.autoplay} onChange={(v) => update({ autoplay: v })} />
          </Row>
          <Row label="Show skip intro button" desc="Display a skip intro button at the start of episodes">
            <Toggle checked={settings.skipIntro} onChange={(v) => update({ skipIntro: v })} />
          </Row>
          <Row label="Default audio mode" desc="Preferred audio track for new episodes">
            <div className="flex gap-2">
              {(["sub", "dub"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => update({ defaultMode: m })}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium uppercase transition-all ${
                    settings.defaultMode === m
                      ? "bg-xan-crimson text-white"
                      : "bg-xan-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Playback speed" desc="Default video playback rate">
            <select
              value={settings.playbackRate}
              onChange={(e) => update({ playbackRate: Number(e.target.value) })}
              className="px-3 py-1.5 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground focus:outline-none focus:border-xan-crimson/50"
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <option key={r} value={r}>{r}x</option>
              ))}
            </select>
          </Row>
        </Section>

        {/* Audio */}
        <Section id="audio" icon={Volume2} title="Audio & Subtitles" desc="Volume and subtitle preferences">
          <Row label="Default volume" desc={`Starting volume: ${settings.volume}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.volume}
              onChange={(e) => update({ volume: Number(e.target.value) })}
              className="w-32 h-1.5 rounded-full appearance-none bg-xan-card cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-xan-crimson"
              style={{ background: `linear-gradient(to right, #e94560 ${settings.volume}%, rgba(255,255,255,0.1) ${settings.volume}%)` }}
            />
          </Row>
        </Section>

        {/* Content */}
        <Section id="content" icon={Compass} title="Content & Discovery" desc="What content is shown">
          <Row label="Content source" desc="Where episodes are sourced from">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-xan-card border border-xan-border">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-foreground">AllAnime</span>
              <span className="text-xs text-muted-foreground">· active</span>
            </div>
          </Row>
          <Row label="Metadata source" desc="Anime info, images, and search">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-xan-card border border-xan-border">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium text-foreground">AniList</span>
              <span className="text-xs text-muted-foreground">· active</span>
            </div>
          </Row>
        </Section>

        {/* Data & Privacy */}
        <Section id="data" icon={Database} title="Data & Privacy" desc="Manage your local data">
          <Row label="Watch history" desc="Clear your episode watch history">
            <button
              onClick={clearHistoryAction}
              className="btn-premium flex items-center gap-2 px-4 py-2 rounded-lg bg-xan-card border border-xan-border hover:border-xan-crimson/40 text-sm text-muted-foreground hover:text-xan-crimson transition-all"
            >
              <Trash2 className="h-4 w-4" /> Clear History
            </button>
          </Row>
          <Row label="Reset all settings" desc="Clear all cached data and reset to defaults">
            <button
              onClick={clearCache}
              className="btn-premium flex items-center gap-2 px-4 py-2 rounded-lg bg-xan-card border border-xan-border hover:border-xan-crimson/40 text-sm text-muted-foreground hover:text-xan-crimson transition-all"
            >
              <Trash2 className="h-4 w-4" /> Reset All
            </button>
          </Row>
        </Section>

        {/* About */}
        <Section id="about" icon={Info} title="About" desc="Information about this build">
          <div className="p-4 rounded-xl bg-gradient-to-br from-xan-crimson/10 to-xan-violet/10 border border-xan-crimson/20">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center">
                <Cloud className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold font-display text-foreground">XAN</h3>
                <p className="text-xs text-muted-foreground">Hono + Vite + React · Cloudflare Workers</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" /> Tier 2 client-side fetch architecture
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" /> AES-256-CTR decryption in browser (WebCrypto)
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" /> Zero streaming bandwidth on Cloudflare
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3 w-3 text-green-500" /> Runs on Workers Free tier ($0/mo)
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-xan-border flex items-center gap-3">
              <a
                href="https://github.com/smithP2007/XAN"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Github className="h-3.5 w-3.5" /> Source
              </a>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-xs text-muted-foreground">Data: AniList + AllAnime</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  desc,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="glass rounded-2xl p-5 md:p-6 scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-lg bg-xan-card flex items-center justify-center">
          <Icon className="h-4 w-4 text-xan-crimson" />
        </div>
        <div>
          <h2 className="font-bold font-display text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div className="divide-y divide-xan-border">{children}</div>
    </section>
  );
}

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`toggle-switch ${checked ? "active" : ""}`}
      role="switch"
      aria-checked={checked}
    />
  );
}
