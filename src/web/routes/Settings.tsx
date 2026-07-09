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
import {
  useVideoEnhancer,
  ENHANCER_PRESETS as ENHANCER_PRESET_LIST,
  type EnhancerState,
} from "../hooks/useVideoEnhancer";

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

// Known stream sources — shown in Settings > Bandwidth > Source filters
const KNOWN_SOURCES: { name: string; type: "mp4" | "hls" | "iframe"; desc: string }[] = [
  { name: "Mp4", type: "mp4", desc: "AllAnime — mp4upload.com direct MP4. Plays in custom player with seeking." },
  { name: "Ok", type: "iframe", desc: "AllAnime — Ok.ru video embed." },
  { name: "Zen", type: "iframe", desc: "FlixCloud embed. Dual audio (sub + dub)." },
  { name: "Zen (Dual→Dub)", type: "iframe", desc: "FlixCloud embed labeled for dub mode." },
  { name: "Koto", type: "iframe", desc: "MegaPlay embed. Direct iframe, always available." },
];

export function Settings() {
  const [settings, update] = useSettings();
  const [activeSection, setActiveSection] = useState<string>("appearance");
  const [searchQuery, setSearchQuery] = useState("");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const enhancer = useVideoEnhancer();

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
          desc="Color grading for the video player — 9 controls + 20 built-in presets. Applies to both video and iframe players. Press E while watching to toggle."
        >
          <Row
            label="Enable Video Enhancer"
            desc="When on, color grading is applied to the video. When off, all filters are bypassed. Press E in the player to toggle."
          >
            <Toggle
              checked={enhancer.state.enabled}
              onChange={() => enhancer.toggleEnabled()}
            />
          </Row>
          <Row
            label="Built-in presets"
            desc="Quick one-tap color grading. Click to apply — enhancer turns on automatically."
          >
            <div className="flex flex-wrap gap-1.5 justify-end max-w-md">
              {Object.entries(ENHANCER_PRESET_LIST).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => enhancer.applyPreset(id as keyof typeof ENHANCER_PRESET_LIST)}
                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-xan-card border border-xan-border hover:border-xan-crimson/40 hover:text-foreground text-muted-foreground transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </Row>
          <EnhancerRow
            label="Brightness"
            value={enhancer.state.brightness}
            min={0}
            max={200}
            step={1}
            neutral={100}
            unit="%"
            disabled={!enhancer.state.enabled}
            onChange={(v) => enhancer.update("brightness", v)}
          />
          <EnhancerRow
            label="Contrast"
            value={enhancer.state.contrast}
            min={0}
            max={200}
            step={1}
            neutral={100}
            unit="%"
            disabled={!enhancer.state.enabled}
            onChange={(v) => enhancer.update("contrast", v)}
          />
          <EnhancerRow
            label="Saturation"
            value={enhancer.state.saturation}
            min={0}
            max={200}
            step={1}
            neutral={100}
            unit="%"
            disabled={!enhancer.state.enabled}
            onChange={(v) => enhancer.update("saturation", v)}
          />
          <EnhancerRow
            label="Hue"
            value={enhancer.state.hue}
            min={-180}
            max={180}
            step={5}
            neutral={0}
            unit="°"
            disabled={!enhancer.state.enabled}
            onChange={(v) => enhancer.update("hue", v)}
          />
          <EnhancerRow
            label="Gamma"
            value={enhancer.state.gamma}
            min={0.2}
            max={3.0}
            step={0.05}
            neutral={1.0}
            disabled={!enhancer.state.enabled}
            onChange={(v) => enhancer.update("gamma", v)}
          />
          <EnhancerRow
            label="Sharpen"
            value={enhancer.state.sharpen}
            min={0}
            max={100}
            step={5}
            neutral={0}
            unit="%"
            disabled={!enhancer.state.enabled}
            onChange={(v) => enhancer.update("sharpen", v)}
          />
          <EnhancerRow
            label="Blur"
            value={enhancer.state.blur}
            min={0}
            max={10}
            step={0.5}
            neutral={0}
            unit="px"
            disabled={!enhancer.state.enabled}
            onChange={(v) => enhancer.update("blur", v)}
          />
          <EnhancerRow
            label="Sepia"
            value={enhancer.state.sepia}
            min={0}
            max={100}
            step={5}
            neutral={0}
            unit="%"
            disabled={!enhancer.state.enabled}
            onChange={(v) => enhancer.update("sepia", v)}
          />
          <EnhancerRow
            label="Grayscale"
            value={enhancer.state.grayscale}
            min={0}
            max={100}
            step={5}
            neutral={0}
            unit="%"
            disabled={!enhancer.state.enabled}
            onChange={(v) => enhancer.update("grayscale", v)}
          />
          <Row label="Reset enhancer" desc="Restore all enhancer values to defaults">
            <button
              onClick={enhancer.reset}
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

          {/* Source filters — toggle individual sources on/off + pin */}
          <div className="py-4">
            <div className="mb-3">
              <p className="font-medium text-sm text-foreground">Source filters</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Toggle sources on/off.{" "}
                <span className="text-xan-crimson font-medium">Click the dot (●)</span> to pin — only that source loads, no fallback.
              </p>
            </div>

            {/* Pinned source indicator */}
            {settings.pinnedSource && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-xan-crimson/10 border border-xan-crimson/30 text-xs">
                <span className="w-2 h-2 rounded-full bg-xan-crimson animate-pulse flex-shrink-0" />
                <span className="text-xan-crimson font-medium">
                  Pinned: <span className="font-mono">{settings.pinnedSource}</span>
                </span>
                <span className="text-muted-foreground">— only this source will load</span>
                <button
                  onClick={() => update({ pinnedSource: null })}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Unpin
                </button>
              </div>
            )}

            {/* Known sources list */}
            <div className="space-y-1.5">
              {KNOWN_SOURCES.map((source) => {
                const isEnabled = !settings.disabledSources.includes(source.name);
                const isPinned = settings.pinnedSource === source.name;
                return (
                  <div
                    key={source.name}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
                      isPinned
                        ? "bg-xan-crimson/10 border-xan-crimson/40"
                        : isEnabled
                          ? "bg-xan-card/60 border-xan-border"
                          : "bg-red-500/5 border-red-500/20"
                    }`}
                  >
                    {/* Pin dot button */}
                    <button
                      onClick={() => {
                        update({ pinnedSource: isPinned ? null : source.name });
                      }}
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                        isPinned
                          ? "bg-xan-crimson border-xan-crimson shadow-[0_0_6px_rgba(233,69,96,0.6)]"
                          : "bg-transparent border-muted-foreground/40 hover:border-foreground"
                      }`}
                      aria-label={isPinned ? `Unpin ${source.name}` : `Pin ${source.name}`}
                      title={isPinned ? "Pinned — click to unpin" : "Pin: only this source will load (no fallback)"}
                    >
                      {isPinned && <span className="w-2 h-2 rounded-full bg-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground font-mono">{source.name}</span>
                        <span className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${
                          source.type === "iframe" ? "bg-purple-500/20 text-purple-400"
                          : source.type === "hls" ? "bg-blue-500/20 text-blue-400"
                          : "bg-green-500/20 text-green-400"
                        }`}>
                          {source.type}
                        </span>
                        {isPinned && (
                          <span className="text-[9px] font-bold uppercase px-1 py-0.5 rounded bg-xan-crimson/25 text-xan-crimson border border-xan-crimson/30">
                            PINNED
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{source.desc}</p>
                    </div>
                    <Toggle
                      checked={isEnabled}
                      onChange={(checked) => {
                        if (checked) {
                          update({ disabledSources: settings.disabledSources.filter((n) => n !== source.name) });
                        } else {
                          update({ disabledSources: [...settings.disabledSources, source.name] });
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Enable all button */}
            {settings.disabledSources.length > 0 && (
              <button
                onClick={() => update({ disabledSources: [] })}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground underline"
              >
                Enable all sources
              </button>
            )}
          </div>
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
// EnhancerState + ENHANCER_PRESETS are now imported from ../hooks/useVideoEnhancer

function EnhancerRow({
  label,
  value,
  min,
  max,
  step,
  neutral,
  unit = "",
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  neutral?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const isDefault = neutral !== undefined && Math.abs(value - neutral) < 0.001;
  const display = unit === "°" || unit === "%"
    ? Math.round(value)
    : value.toFixed(2);
  return (
    <div
      className={`flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-foreground">{label}</p>
        <p className={`text-xs mt-0.5 ${isDefault ? "text-muted-foreground" : "text-xan-crimson"}`}>
          {isDefault ? "Default" : `${display}${unit}`}
        </p>
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
        <span className={`text-xs font-mono w-12 text-right ${isDefault ? "text-muted-foreground" : "text-xan-crimson"}`}>
          {display}{unit}
        </span>
      </div>
    </div>
  );
}
