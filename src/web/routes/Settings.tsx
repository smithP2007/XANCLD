import { useState, useEffect, useRef } from "react";
import {
  Palette,
  Play,
  Volume2,
  Compass,
  Database,
  Info,
  Sun,
  Moon,
  Monitor,
  Trash2,
  Github,
  Cloud,
  Check,
  Sliders,
  Eye,
  ShieldAlert,
  Cpu,
  Search as SearchIcon,
  Zap,
  Languages,
  Power,
  Sparkles,
  Server,
  Gauge,
  RotateCcw,
  SkipForward,
  SkipBack,
} from "lucide-react";
import { useSettings, clearHistory, getHistory } from "../hooks/useSettings";

interface Section {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: Section[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "playback", label: "Playback", icon: Play },
  { id: "audio", label: "Audio & Subtitles", icon: Languages },
  { id: "enhancer", label: "Video Enhancer", icon: Sliders },
  { id: "bandwidth", label: "Bandwidth", icon: Zap },
  { id: "content", label: "Content & Discovery", icon: Compass },
  { id: "data", label: "Data & Privacy", icon: Database },
  { id: "about", label: "About", icon: Info },
];

export function Settings() {
  const [settings, update] = useSettings();
  const [activeSection, setActiveSection] = useState<string>("appearance");
  const [searchQuery, setSearchQuery] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [enhancer, setEnhancer] = useState<EnhancerState>({
    brightness: 1,
    contrast: 1,
    saturation: 1,
    hue: 0,
    gamma: 1,
    sharpen: 0,
    blur: 0,
    sepia: 0,
    grayscale: 0,
  });

  const updateEnhancer = (next: EnhancerState) => {
    setEnhancer(next);
    localStorage.setItem("xan:video-enhancer", JSON.stringify(next));
  };

  // Load enhancer settings on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("xan:video-enhancer");
      if (raw) {
        const parsed = JSON.parse(raw);
        setEnhancer({
          brightness: 1, contrast: 1, saturation: 1,
          hue: 0, gamma: 1, sharpen: 0, blur: 0, sepia: 0, grayscale: 0,
          ...parsed,
        });
      }
    } catch {
      // ignore
    }
  }, []);

  // Scroll-spy: highlight current section in nav
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    for (const id of SECTIONS.map((s) => s.id)) {
      const el = document.getElementById(id);
      if (el) {
        sectionRefs.current[id] = el;
        observer.observe(el);
      }
    }
    return () => observer.disconnect();
  }, []);

  const clearHistoryAction = () => {
    if (confirm("Clear all watch history? This cannot be undone.")) {
      clearHistory();
      alert("History cleared.");
    }
  };

  const exportHistory = () => {
    const history = getHistory();
    const blob = new Blob([JSON.stringify(history, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `xan-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearCache = () => {
    if (confirm("Clear all cached data? This will reset settings to defaults.")) {
      localStorage.clear();
      location.reload();
    }
  };

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Filter sections by search
  const filteredSections = SECTIONS.filter((s) =>
    searchQuery.trim()
      ? s.label.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

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

      {/* Search + section nav */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 sticky top-16 z-10 bg-background/80 backdrop-blur-md py-3 -mx-4 px-4 border-b border-xan-border">
        <div className="relative flex-1 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter settings..."
            className="w-full pl-9 pr-3 h-9 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {filteredSections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeSection === s.id
                  ? "bg-xan-crimson/20 border border-xan-crimson/40 text-foreground"
                  : "bg-xan-card border border-xan-border text-muted-foreground hover:text-foreground hover:bg-xan-card-hover"
              }`}
            >
              <s.icon className="h-3 w-3" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Appearance */}
        <Section id="appearance" icon={Palette} title="Appearance" desc="Customize how XAN looks">
          <Row label="Theme" desc="Choose your preferred color scheme — applies instantly">
            <div className="flex gap-2">
              <button
                onClick={() => update({ theme: "dark" })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  settings.theme === "dark"
                    ? "bg-xan-crimson/20 border-xan-crimson/50 text-foreground"
                    : "bg-xan-card border-xan-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Moon className="h-4 w-4" /> Dark
              </button>
              <button
                onClick={() => update({ theme: "light" })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  settings.theme === "light"
                    ? "bg-xan-crimson/20 border-xan-crimson/50 text-foreground"
                    : "bg-xan-card border-xan-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sun className="h-4 w-4" /> Light
              </button>
              <button
                onClick={() => update({ theme: "system" })}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${
                  settings.theme === "system"
                    ? "bg-xan-crimson/20 border-xan-crimson/50 text-foreground"
                    : "bg-xan-card border-xan-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Monitor className="h-4 w-4" /> System
              </button>
            </div>
          </Row>
          <Row
            label="Reduced motion"
            desc="Disable Ken Burns, ambient blobs, card animations for accessibility"
          >
            <Toggle
              checked={settings.reducedMotion}
              onChange={(v) => update({ reducedMotion: v })}
            />
          </Row>
          <Row
            label="TV mode"
            desc="Disable backdrop-blur and other GPU-expensive effects for low-power devices"
          >
            <Toggle checked={settings.tvMode} onChange={(v) => update({ tvMode: v })} />
          </Row>
        </Section>

        {/* Playback */}
        <Section id="playback" icon={Play} title="Playback" desc="Control video playback behavior">
          <Row
            label="Autoplay next episode"
            desc="Show a 10-second countdown to play the next episode when current ends"
          >
            <Toggle checked={settings.autoplay} onChange={(v) => update({ autoplay: v })} />
          </Row>
          <Row
            label="Auto-resume from last position"
            desc="When revisiting an episode, jump to where you left off"
          >
            <Toggle checked={settings.autoResume} onChange={(v) => update({ autoResume: v })} />
          </Row>
          <Row
            label="Show skip intro button"
            desc="Display a skip intro button at the start of episodes (first ~85 seconds)"
          >
            <Toggle checked={settings.skipIntro} onChange={(v) => update({ skipIntro: v })} />
          </Row>
          <Row
            label="Show skip outro button"
            desc="Display a skip outro button near the end of episodes"
          >
            <Toggle checked={settings.skipOutro} onChange={(v) => update({ skipOutro: v })} />
          </Row>
          <Row label="Default playback speed" desc="Start every episode at this speed (adjustable during playback)">
            <select
              value={settings.playbackRate}
              onChange={(e) => update({ playbackRate: Number(e.target.value) })}
              className="px-3 py-1.5 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground focus:outline-none focus:border-xan-crimson/50"
            >
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <option key={r} value={r}>
                  {r === 1 ? "1× (Normal)" : `${r}×`}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        {/* Audio & Subtitles */}
        <Section id="audio" icon={Languages} title="Audio & Subtitles" desc="Pick your preferred audio track by default">
          <Row
            label="Default audio mode"
            desc="Choose SUB (Japanese audio + English subtitles) or DUB (English dubbed audio). You can still switch during playback."
          >
            <div className="flex gap-1.5 bg-xan-card/60 p-1 rounded-lg border border-xan-border">
              {(["sub", "dub"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => update({ defaultMode: mode })}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                    settings.defaultMode === mode
                      ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "sub" ? "SUB" : "DUB"}
                </button>
              ))}
            </div>
          </Row>
          <Row label="Default volume" desc={`Start every episode at this volume — current: ${settings.volume}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.volume}
              onChange={(e) => update({ volume: Number(e.target.value) })}
              className="w-32 h-1.5 rounded-full appearance-none bg-xan-card cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-xan-crimson"
              style={{
                background: `linear-gradient(to right, #e94560 ${settings.volume}%, rgba(255,255,255,0.1) ${settings.volume}%)`,
              }}
            />
          </Row>
        </Section>

        {/* Video Enhancer */}
        <Section
          id="enhancer"
          icon={Sliders}
          title="Video Enhancer"
          desc="Color grading for the video player — brightness, contrast, saturation, hue, gamma, and more. Press E while watching to toggle."
        >
          <Row
            label="Enable Video Enhancer"
            desc="When on, color grading is applied to the video. When off, all filters are bypassed. Press E in the player to toggle."
          >
            <Toggle
              checked={settings.enhancerEnabled}
              onChange={(v) => update({ enhancerEnabled: v })}
            />
          </Row>
          <Row
            label="Built-in presets"
            desc="Quick one-tap color grading. Click to apply — enhancer turns on automatically."
          >
            <div className="flex flex-wrap gap-1.5 justify-end">
              {ENHANCER_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => {
                    const next = { ...p.values };
                    setEnhancer(next);
                    localStorage.setItem("xan:video-enhancer", JSON.stringify(next));
                    if (!settings.enhancerEnabled) update({ enhancerEnabled: true });
                  }}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-xan-card border border-xan-border hover:border-xan-crimson/40 hover:text-foreground text-muted-foreground transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </Row>
          <EnhancerRow
            label="Brightness"
            value={enhancer.brightness}
            min={0.5}
            max={1.5}
            step={0.05}
            disabled={!settings.enhancerEnabled}
            onChange={(v) => updateEnhancer({ ...enhancer, brightness: v })}
          />
          <EnhancerRow
            label="Contrast"
            value={enhancer.contrast}
            min={0.5}
            max={1.5}
            step={0.05}
            disabled={!settings.enhancerEnabled}
            onChange={(v) => updateEnhancer({ ...enhancer, contrast: v })}
          />
          <EnhancerRow
            label="Saturation"
            value={enhancer.saturation}
            min={0}
            max={2}
            step={0.05}
            disabled={!settings.enhancerEnabled}
            onChange={(v) => updateEnhancer({ ...enhancer, saturation: v })}
          />
          <EnhancerRow
            label="Hue"
            value={enhancer.hue ?? 0}
            min={0}
            max={360}
            step={5}
            unit="°"
            disabled={!settings.enhancerEnabled}
            onChange={(v) => updateEnhancer({ ...enhancer, hue: v })}
          />
          <EnhancerRow
            label="Gamma"
            value={enhancer.gamma ?? 1}
            min={0.5}
            max={2}
            step={0.05}
            disabled={!settings.enhancerEnabled}
            onChange={(v) => updateEnhancer({ ...enhancer, gamma: v })}
          />
          <EnhancerRow
            label="Sharpen"
            value={enhancer.sharpen ?? 0}
            min={0}
            max={100}
            step={5}
            unit="%"
            disabled={!settings.enhancerEnabled}
            onChange={(v) => updateEnhancer({ ...enhancer, sharpen: v })}
          />
          <EnhancerRow
            label="Blur"
            value={enhancer.blur ?? 0}
            min={0}
            max={10}
            step={0.5}
            unit="px"
            disabled={!settings.enhancerEnabled}
            onChange={(v) => updateEnhancer({ ...enhancer, blur: v })}
          />
          <EnhancerRow
            label="Sepia"
            value={enhancer.sepia ?? 0}
            min={0}
            max={100}
            step={5}
            unit="%"
            disabled={!settings.enhancerEnabled}
            onChange={(v) => updateEnhancer({ ...enhancer, sepia: v })}
          />
          <EnhancerRow
            label="Grayscale"
            value={enhancer.grayscale ?? 0}
            min={0}
            max={100}
            step={5}
            unit="%"
            disabled={!settings.enhancerEnabled}
            onChange={(v) => updateEnhancer({ ...enhancer, grayscale: v })}
          />
          <Row label="Reset enhancer" desc="Restore all enhancer values to defaults">
            <button
              onClick={() => {
                const next = {
                  brightness: 1, contrast: 1, saturation: 1,
                  hue: 0, gamma: 1, sharpen: 0, blur: 0, sepia: 0, grayscale: 0,
                };
                setEnhancer(next);
                localStorage.setItem("xan:video-enhancer", JSON.stringify(next));
              }}
              className="px-3 py-1.5 rounded-lg bg-xan-card border border-xan-border hover:border-xan-crimson/40 text-sm text-muted-foreground hover:text-xan-crimson transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </Row>
        </Section>

        {/* Bandwidth */}
        <Section
          id="bandwidth"
          icon={Zap}
          title="Bandwidth"
          desc="Control how video streams are loaded to minimize server costs"
        >
          <Row
            label="Stream loading strategy"
            desc="Choose how the player fetches video data. Direct modes save Worker bandwidth; proxy mode maximizes compatibility."
          >
            <select
              value={settings.bandwidthMode}
              onChange={(e) => update({ bandwidthMode: e.target.value as "auto" | "direct-only" | "proxy-only" })}
              className="px-3 py-1.5 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground focus:outline-none focus:border-xan-crimson/50 w-44"
            >
              <option value="auto">Auto (recommended)</option>
              <option value="direct-only">Direct only</option>
              <option value="proxy-only">Proxy only (Worker)</option>
            </select>
          </Row>
          <Row
            label="Preferred provider"
            desc="Which anime source API to try first when loading an episode"
          >
            <div className="flex gap-1.5 bg-xan-card/60 p-1 rounded-lg border border-xan-border">
              {(["allanime", "koto", "zen", "gogoanime"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => update({ preferredProvider: p })}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all ${
                    settings.preferredProvider === p
                      ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* Content & Discovery */}
        <Section
          id="content"
          icon={Compass}
          title="Content & Discovery"
          desc="What content is shown and how it's filtered"
        >
          <Row
            label="Hide spoilers"
            desc="Blur synopsis and preview images until you click them"
          >
            <Toggle
              checked={settings.hideSpoilers}
              onChange={(v) => update({ hideSpoilers: v })}
            />
          </Row>
          <Row
            label="Hide adult content"
            desc="Filter out anime marked as 18+ from browse and search results"
          >
            <Toggle checked={settings.hideAdult} onChange={(v) => update({ hideAdult: v })} />
          </Row>
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
          <Row label="Export history" desc="Download your watch history as JSON">
            <button
              onClick={exportHistory}
              className="btn-premium flex items-center gap-2 px-4 py-2 rounded-lg bg-xan-card border border-xan-border hover:border-xan-crimson/40 text-sm text-muted-foreground hover:text-foreground transition-all"
            >
              <Database className="h-4 w-4" /> Export
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
                href="https://github.com/smithP2007/XANCLD"
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
    <section id={id} className="glass rounded-2xl p-5 md:p-6 scroll-mt-32">
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

function EnhancerSlider({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="relative w-32">
      <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full bg-xan-card" />
      <div
        className="absolute inset-y-1/2 -translate-y-1/2 left-0 h-1.5 rounded-full bg-xan-crimson"
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
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
          [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
      />
    </div>
  );
}

// ─── Video Enhancer types & data ───
interface EnhancerState {
  brightness: number;
  contrast: number;
  saturation: number;
  hue?: number;
  gamma?: number;
  sharpen?: number;
  blur?: number;
  sepia?: number;
  grayscale?: number;
}

const ENHANCER_PRESETS: { name: string; values: EnhancerState }[] = [
  {
    name: "Vivid",
    values: { brightness: 1.05, contrast: 1.15, saturation: 1.3, hue: 0, gamma: 1, sharpen: 0, blur: 0, sepia: 0, grayscale: 0 },
  },
  {
    name: "Cinema",
    values: { brightness: 0.95, contrast: 1.1, saturation: 0.9, hue: 0, gamma: 1.1, sharpen: 0, blur: 0, sepia: 5, grayscale: 0 },
  },
  {
    name: "Warm",
    values: { brightness: 1.05, contrast: 1, saturation: 1.1, hue: 10, gamma: 1, sharpen: 0, blur: 0, sepia: 15, grayscale: 0 },
  },
  {
    name: "Cool",
    values: { brightness: 1, contrast: 1.05, saturation: 0.95, hue: 350, gamma: 1, sharpen: 0, blur: 0, sepia: 0, grayscale: 0 },
  },
  {
    name: "Sharp",
    values: { brightness: 1, contrast: 1.1, saturation: 1, hue: 0, gamma: 1, sharpen: 40, blur: 0, sepia: 0, grayscale: 0 },
  },
  {
    name: "B&W",
    values: { brightness: 1.05, contrast: 1.2, saturation: 0, hue: 0, gamma: 1, sharpen: 0, blur: 0, sepia: 0, grayscale: 100 },
  },
  {
    name: "Dreamy",
    values: { brightness: 1.1, contrast: 0.9, saturation: 1.2, hue: 5, gamma: 0.9, sharpen: 0, blur: 1, sepia: 10, grayscale: 0 },
  },
];

function EnhancerRow({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = unit === "°" ? Math.round(value) : unit === "%" ? Math.round(value) : value.toFixed(2);
  return (
    <div
      className={`flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Current: {display}{unit}</p>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <div className="relative w-32">
          <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full bg-xan-card" />
          <div
            className="absolute inset-y-1/2 -translate-y-1/2 left-0 h-1.5 rounded-full bg-xan-crimson"
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
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
              [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
          />
        </div>
        <span className="text-xs font-mono text-muted-foreground w-12 text-right">
          {display}{unit}
        </span>
      </div>
    </div>
  );
}
