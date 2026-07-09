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
  X,
  Save,
  Trash2,
  Bookmark,
  ChevronDown,
} from "lucide-react";
import { useSettings, clearHistory, getHistory } from "../hooks/useSettings";
import {
  useVideoEnhancer,
  ENHANCER_PRESETS as ENHANCER_PRESET_LIST,
  MAX_CUSTOM_PRESETS,
  type EnhancerState,
  type CustomPreset,
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
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-4xl font-display font-bold flex items-center gap-3">
          <span className="bg-gradient-to-r from-xan-crimson to-xan-violet bg-clip-text text-transparent">
            Settings
          </span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Personalize your XAN streaming experience. Changes are saved automatically.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search settings… (e.g. theme, autoplay, subtitles)"
          className="w-full pl-9 pr-9 h-10 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Section nav chips (sticky) */}
      <nav className="sticky top-16 z-20 -mx-4 px-4 py-2 bg-background/80 backdrop-blur-md border-b border-xan-border">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {filteredSections.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                activeSection === s.id
                  ? "bg-gradient-to-r from-xan-crimson to-xan-violet text-white shadow-lg shadow-xan-crimson/20"
                  : "bg-xan-card/60 text-muted-foreground hover:text-foreground hover:bg-xan-card-hover border border-xan-border"
              }`}
            >
              <s.icon className="h-3.5 w-3.5" />
              {s.label}
            </button>
          ))}
        </div>
      </nav>

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
          desc="Color grading with 9 GPU-accelerated filters + 20 presets + custom presets. Press E while watching to toggle."
        >
          {/* Master toggle + status badge */}
          <Row
            label="Enable Video Enhancer"
            desc="When on, color grading applies to both video and iframe players"
          >
            <div className="flex items-center gap-2">
              {enhancer.active && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/30">
                  ACTIVE
                </span>
              )}
              <Toggle
                checked={enhancer.state.enabled}
                onChange={() => enhancer.toggleEnabled()}
              />
            </div>
          </Row>

          {/* Built-in presets — polished grid */}
          <div className="py-4">
            <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-xan-crimson" />
              Built-in Presets
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ENHANCER_PRESET_LIST).map(([id, preset]) => (
                <button
                  key={id}
                  onClick={() => enhancer.applyPreset(id as keyof typeof ENHANCER_PRESET_LIST)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                    enhancer.state.enabled
                      ? "bg-xan-card border-xan-border hover:border-xan-crimson/50 hover:bg-xan-crimson/10 hover:text-foreground text-muted-foreground"
                      : "bg-xan-card/50 border-xan-border/50 text-muted-foreground/40 cursor-not-allowed"
                  }`}
                  disabled={!enhancer.state.enabled}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom presets — save + list */}
          <div className="py-4 border-t border-xan-border">
            <p className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
              <Bookmark className="h-3.5 w-3.5 text-xan-crimson" />
              My Presets
              <span className="text-[10px] text-muted-foreground font-normal">
                ({enhancer.customPresets.length}/{MAX_CUSTOM_PRESETS})
              </span>
            </p>
            {/* Save form */}
            {enhancer.canSaveMoreCustom ? (
              <EnhancerPresetSaver
                disabled={!enhancer.state.enabled}
                onSave={(name) => enhancer.saveCustomPreset(name)}
              />
            ) : (
              <p className="text-[11px] text-muted-foreground/60 italic">
                Max {MAX_CUSTOM_PRESETS} presets reached — delete one to save more
              </p>
            )}
            {/* Saved presets list */}
            {enhancer.customPresets.length > 0 ? (
              <div className="mt-2 space-y-1">
                {enhancer.customPresets.map((cp) => (
                  <div
                    key={cp.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-xan-card/60 border border-xan-border group hover:border-xan-crimson/30 transition-colors"
                  >
                    <button
                      onClick={() => enhancer.applyCustomPreset(cp.id)}
                      disabled={!enhancer.state.enabled}
                      className="flex-1 text-left text-xs text-foreground font-medium hover:text-xan-crimson transition-colors disabled:opacity-40"
                    >
                      {cp.name}
                    </button>
                    <span className="text-[9px] text-muted-foreground/50">
                      B{cp.values.brightness} C{cp.values.contrast} S{cp.values.saturation}
                    </span>
                    <button
                      onClick={() => enhancer.deleteCustomPreset(cp.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all p-0.5"
                      aria-label="Delete preset"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground/40 italic mt-1">
                No saved presets yet — adjust the sliders and save your favorite combination
              </p>
            )}
          </div>

          {/* Manual controls — collapsible */}
          <EnhancerManualControls
            enhancer={enhancer}
          />

          {/* Reset */}
          <div className="pt-4 border-t border-xan-border">
            <button
              onClick={enhancer.reset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-xan-card border border-xan-border hover:border-xan-crimson/40 text-xs text-muted-foreground hover:text-xan-crimson transition-all"
            >
              <RotateCcw className="h-3 w-3" /> Reset all to defaults
            </button>
          </div>
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
    <section id={id} className="glass rounded-2xl p-4 md:p-6 scroll-mt-32">
      {/* Section header — gradient icon box like XAN */}
      <div className="flex items-start gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-xan-crimson/20 to-xan-violet/20 border border-xan-border flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-xan-crimson" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base md:text-lg font-display font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
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
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <div className="flex-shrink-0 self-start sm:self-center">{children}</div>
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
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 py-4 first:pt-0 last:pb-0 ${
        disabled ? "opacity-40 pointer-events-none" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm text-foreground">{label}</p>
        <p className={`text-xs mt-0.5 ${isDefault ? "text-muted-foreground" : "text-xan-crimson"}`}>
          {isDefault ? "Default" : `${display}${unit}`}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-3 self-start sm:self-center">
        <div className="relative w-full sm:w-32">
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

// ─── Enhancer preset saver (inline form) ──────────────────────
function EnhancerPresetSaver({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (name: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="flex gap-1.5">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) {
            onSave(name);
            setName("");
          }
        }}
        placeholder="Name your preset..."
        maxLength={24}
        disabled={disabled}
        className="flex-1 h-8 px-2.5 rounded-lg bg-xan-card border border-xan-border text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-xan-crimson/40 disabled:opacity-40"
      />
      <button
        onClick={() => {
          if (name.trim()) {
            onSave(name);
            setName("");
          }
        }}
        disabled={disabled || !name.trim()}
        className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-xan-crimson/20 text-xan-crimson border border-xan-crimson/30 text-xs font-medium hover:bg-xan-crimson/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Save className="h-3 w-3" />
        Save
      </button>
    </div>
  );
}

// ─── Collapsible manual controls ──────────────────────────────
function EnhancerManualControls({
  enhancer,
}: {
  enhancer: ReturnType<typeof useVideoEnhancer>;
}) {
  const [open, setOpen] = useState(false);

  const SLIDERS: {
    key: keyof EnhancerState;
    label: string;
    min: number;
    max: number;
    step: number;
    neutral: number;
    unit?: string;
  }[] = [
    { key: "brightness", label: "Brightness", min: 0, max: 200, step: 1, neutral: 100, unit: "%" },
    { key: "contrast", label: "Contrast", min: 0, max: 200, step: 1, neutral: 100, unit: "%" },
    { key: "saturation", label: "Saturation", min: 0, max: 200, step: 1, neutral: 100, unit: "%" },
    { key: "hue", label: "Hue", min: -180, max: 180, step: 5, neutral: 0, unit: "°" },
    { key: "blur", label: "Blur", min: 0, max: 10, step: 0.5, neutral: 0, unit: "px" },
    { key: "sepia", label: "Sepia", min: 0, max: 100, step: 5, neutral: 0, unit: "%" },
    { key: "grayscale", label: "Grayscale", min: 0, max: 100, step: 5, neutral: 0, unit: "%" },
    { key: "gamma", label: "Gamma", min: 0.2, max: 3.0, step: 0.05, neutral: 1.0 },
    { key: "sharpen", label: "Sharpen", min: 0, max: 100, step: 5, neutral: 0, unit: "%" },
  ];

  return (
    <div className="py-4 border-t border-xan-border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-xs font-medium text-foreground"
      >
        <span>Manual Controls (9 sliders)</span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
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
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-foreground">{slider.label}</span>
                  <span className={`text-[10px] font-mono ${isDefault ? "text-muted-foreground" : "text-xan-crimson"}`}>
                    {isDefault ? "Default" : `${display}${slider.unit}`}
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-xan-card" />
                  <div
                    className="absolute inset-y-1/2 -translate-y-1/2 left-0 h-1 rounded-full bg-gradient-to-r from-xan-crimson to-xan-violet"
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
    </div>
  );
}
