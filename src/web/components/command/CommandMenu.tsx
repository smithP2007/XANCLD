// ─── CommandMenu (⌘K) — Minimalistic Edition ───────────────────
// Spotlight/Raycast-style command palette. Mounted globally so it's
// available on every page.
//
// Triggers:
//  - Cmd/Ctrl+K  → toggle open/closed
//  - "/"          → open (when not in an input field)
//  - Clicking the Command button in the Navbar
//
// Tabs (5, ⌘1-5 hotkeys):
//   1 All     2 Anime   3 Pages   4 Actions   5 History
//
// Section order (when visible under All tab):
//   Search Results → Recently Visited → Pages → Continue Watching →
//   Bookmarks → Random → Trending (collapsible) → Genre (dropdown,
//   closed) → Season (dropdown, closed) → Airing Today (dropdown,
//   closed, lazy-load on expand).

import {
  useState, useEffect, useRef, useMemo, useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Search, Clock, Compass, Home as HomeIcon,
  Calendar, Library, History as HistoryIcon, Settings as SettingsIcon,
  CornerDownLeft, ArrowUp, ArrowDown, X, Globe, ChevronDown,
  Hash, Star, Dice5,
} from "lucide-react";
import {
  searchAnime, fetchTrending, fetchPopular, fetchSchedule, getTitle,
  type AnimeCard,
} from "../../lib/anilist";
import { useRecentlyVisited } from "../../hooks/useRecentlyVisited";
import { useBookmarks } from "../../hooks/useBookmarks";
import { useWatchHistory } from "../../hooks/useSettings";
import { useDebounce } from "../../hooks/useDebounce";

// ─── Custom event the Navbar dispatches to open the menu ────────
export const OPEN_COMMAND_MENU_EVENT = "xan:open-command-menu";

export function openCommandMenu(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_COMMAND_MENU_EVENT));
}

// ─── Module-level caches (rate-limit protection) ───────────────
let trendingCache: AnimeCard[] | null = null;
let trendingPromise: Promise<AnimeCard[]> | null = null;
function fetchTrendingCached(): Promise<AnimeCard[]> {
  if (trendingCache) return Promise.resolve(trendingCache);
  if (trendingPromise) return trendingPromise;
  trendingPromise = fetchTrending(5)
    .then((arr) => { trendingCache = arr; return arr; })
    .catch(() => { trendingCache = []; return []; })
    .finally(() => { trendingPromise = null; });
  return trendingPromise;
}

let popularCache: AnimeCard[] | null = null;
let popularPromise: Promise<AnimeCard[]> | null = null;
function fetchPopularCached(): Promise<AnimeCard[]> {
  if (popularCache) return Promise.resolve(popularCache);
  if (popularPromise) return popularPromise;
  popularPromise = fetchPopular(50)
    .then((arr) => { popularCache = arr; return arr; })
    .catch(() => { popularCache = []; return []; })
    .finally(() => { popularPromise = null; });
  return popularPromise;
}

let airingCache: AnimeCard[] | null = null;
let airingPromise: Promise<AnimeCard[]> | null = null;
function fetchAiringTodayCached(): Promise<AnimeCard[]> {
  if (airingCache) return Promise.resolve(airingCache);
  if (airingPromise) return airingPromise;
  airingPromise = fetchSchedule(50, 2)
    .then((arr) => {
      const now = Date.now();
      const in24h = now + 24 * 60 * 60 * 1000;
      airingCache = arr
        .filter((a) => {
          const ts = (a as { nextAiringEpisode?: { airingAt?: number } }).nextAiringEpisode?.airingAt;
          if (!ts) return false;
          const ms = ts * 1000;
          return ms >= now && ms <= in24h;
        })
        .slice(0, 8);
      return airingCache;
    })
    .catch(() => { airingCache = []; return []; })
    .finally(() => { airingPromise = null; });
  return airingPromise;
}

// ─── Tab definitions ───────────────────────────────────────────
type Tab = "all" | "anime" | "pages" | "actions" | "history";

const TABS: { id: Tab; label: string; hotkey: string }[] = [
  { id: "all",     label: "All",     hotkey: "1" },
  { id: "anime",   label: "Anime",   hotkey: "2" },
  { id: "pages",   label: "Pages",   hotkey: "3" },
  { id: "actions", label: "Actions", hotkey: "4" },
  { id: "history", label: "History", hotkey: "5" },
];

// ─── Page navigation entries ───────────────────────────────────
const PAGE_ENTRIES = [
  { label: "Home", to: "/home", icon: HomeIcon },
  { label: "Discover", to: "/trending", icon: Compass },
  { label: "Browse", to: "/browse", icon: Globe },
  { label: "Schedule", to: "/schedule", icon: Calendar },
  { label: "Library", to: "/list", icon: Library },
  { label: "History", to: "/history", icon: HistoryIcon },
  { label: "Settings", to: "/settings", icon: SettingsIcon },
];

const TOP_GENRES = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror",
  "Mecha", "Mystery", "Romance", "Sci-Fi", "Slice of Life", "Supernatural",
];

function buildSeasonShortcuts(): { label: string; year: number }[] {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const seasonsByMonth = [
    { season: "WINTER", year }, { season: "WINTER", year }, { season: "WINTER", year },
    { season: "SPRING", year }, { season: "SPRING", year }, { season: "SPRING", year },
    { season: "SUMMER", year }, { season: "SUMMER", year }, { season: "SUMMER", year },
    { season: "FALL", year }, { season: "FALL", year }, { season: "FALL", year },
  ];
  const current = seasonsByMonth[month];
  const order = ["WINTER", "SPRING", "SUMMER", "FALL"];
  const out: { season: string; year: number }[] = [];
  let sIdx = order.indexOf(current.season);
  let y = current.year;
  for (let i = 0; i < 4; i++) {
    out.push({ season: order[sIdx], year: y });
    sIdx--;
    if (sIdx < 0) { sIdx = 3; y--; }
  }
  return out.map((s) => ({
    label: `${s.season.charAt(0) + s.season.slice(1).toLowerCase()} ${s.year}`,
    year: s.year,
  }));
}

// ─── Single command entry ──────────────────────────────────────
interface CmdItem {
  id: string;
  label: string;
  sublabel?: string;
  thumbnail?: string;
  badge?: string;
  score?: number | null;
  icon?: React.ComponentType<{ className?: string }>;
  onSelect: () => void;
}

interface CmdSection {
  id: string;
  label: string;
  items: CmdItem[];
  tabs: Tab[];
  /** Collapsible dropdown — clicking the header toggles visibility. */
  collapsible?: boolean;
  /** Initial collapsed state (only meaningful if collapsible). */
  defaultCollapsed?: boolean;
  /** Footer (e.g. "Show all N"). */
  footer?: { label: string; onClick: () => void } | null;
  /** Lazy-load callback — fired when the section is first expanded. */
  onExpand?: () => void;
}

// ─── localStorage for collapsed-state persistence ─────────────
const COLLAPSE_KEY = "xan:cmd-collapsed";
function loadCollapsed(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveCollapsed(state: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [searchResults, setSearchResults] = useState<AnimeCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [trending, setTrending] = useState<AnimeCard[] | null>(null);
  const [airing, setAiring] = useState<AnimeCard[] | null>(null);
  const [airingLoading, setAiringLoading] = useState(false);
  // Collapsed state — initialized from localStorage. Sections with
  // defaultCollapsed=true get added to the map if not already there.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const loaded = loadCollapsed();
    // Apply defaults — genres/seasons/airing default closed
    return {
      trending: false,
      genres: true,
      seasons: true,
      airing: true,
      ...loaded,
    };
  });
  const [bookmarksExpanded, setBookmarksExpanded] = useState(false);
  const [randomLoading, setRandomLoading] = useState(false);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastSearchedRef = useRef<string>("");

  const { items: recentVisits } = useRecentlyVisited();
  const { bookmarks } = useBookmarks();
  const history = useWatchHistory();
  const debouncedQuery = useDebounce(query, 300);

  // ─── Open/close ───
  const openMenu = useCallback(() => {
    setOpen(true);
    setQuery("");
    setActiveIndex(0);
    setActiveTab("all");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSearchResults([]);
  }, []);

  const toggleCollapse = useCallback((id: string, onExpand?: () => void) => {
    setCollapsed((prev) => {
      const willExpand = prev[id]; // currently collapsed → will expand
      const next = { ...prev, [id]: !prev[id] };
      saveCollapsed(next);
      if (willExpand && onExpand) onExpand();
      return next;
    });
  }, []);

  // ─── Keyboard: ⌘K, ⌘1-5, /, Esc ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => {
          if (!v) {
            setQuery("");
            setActiveIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
          return !v;
        });
        return;
      }
      if (open && (e.metaKey || e.ctrlKey) && /^[1-5]$/.test(e.key)) {
        e.preventDefault();
        setActiveTab(TABS[parseInt(e.key, 10) - 1].id);
        setActiveIndex(0);
        return;
      }
      if (e.key === "/" && !open) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea" && !target?.isContentEditable) {
          e.preventDefault();
          openMenu();
        }
      }
      if (e.key === "Escape" && open) closeMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, openMenu, closeMenu]);

  useEffect(() => {
    const onOpen = () => openMenu();
    window.addEventListener(OPEN_COMMAND_MENU_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_COMMAND_MENU_EVENT, onOpen);
  }, [openMenu]);

  // ─── Debounced search ───
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    if (q === lastSearchedRef.current) return;
    lastSearchedRef.current = q;
    let cancelled = false;
    setSearching(true);
    searchAnime(q, 1, 8)
      .then((r) => { if (!cancelled) setSearchResults(r.media); })
      .finally(() => { if (!cancelled) setSearching(false); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // ─── Lazy-load trending on first open ───
  useEffect(() => {
    if (!open || trending !== null) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      fetchTrendingCached().then((arr) => { if (!cancelled) setTrending(arr); });
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, trending]);

  // ─── Lazy-load airing on first expand of the Airing section ───
  const loadAiring = useCallback(() => {
    if (airing !== null || airingLoading) return;
    setAiringLoading(true);
    fetchAiringTodayCached()
      .then(setAiring)
      .finally(() => setAiringLoading(false));
  }, [airing, airingLoading]);

  // ─── Pick random anime ───
  const pickRandom = useCallback(() => {
    setRandomLoading(true);
    fetchPopularCached()
      .then((arr) => {
        if (arr.length === 0) return;
        const pick = arr[Math.floor(Math.random() * arr.length)];
        navigate(`/anime/${pick.id}`);
        closeMenu();
      })
      .finally(() => setRandomLoading(false));
  }, [navigate, closeMenu]);

  const seasonShortcuts = useMemo(() => buildSeasonShortcuts(), []);

  // ─── Build sections (NEW ORDER: Recent → Pages → Continue → Bookmarks → Random → Trending → Genres → Seasons → Airing) ───
  const allSections: CmdSection[] = useMemo(() => {
    const out: CmdSection[] = [];
    const push = (s: CmdSection) => {
      // Collapsible sections always render (even when empty), so the dropdown header is visible.
      if (s.items.length > 0 || s.footer || s.collapsible) out.push(s);
    };

    // 1. Search Results
    push({
      id: "search",
      label: searching ? "Searching…" : `Search Results · ${searchResults.length}`,
      tabs: ["all", "anime"],
      items: searchResults.map((a) => ({
        id: `search-${a.id}`,
        label: getTitle(a.title),
        sublabel: [a.format, a.seasonYear].filter(Boolean).join(" • "),
        thumbnail: a.coverImage?.large,
        score: a.averageScore,
        onSelect: () => { navigate(`/anime/${a.id}`); closeMenu(); },
      })),
    });

    // 2. Recently Visited
    push({
      id: "recent",
      label: `Recently Visited · ${recentVisits.length}`,
      tabs: ["all", "anime", "history"],
      items: recentVisits.map((v) => ({
        id: `recent-${v.id}`,
        label: v.title,
        thumbnail: v.coverImage,
        onSelect: () => { navigate(`/anime/${v.id}`); closeMenu(); },
      })),
    });

    // 3. Pages (now second after Recently Visited)
    if (!query.trim()) {
      push({
        id: "pages",
        label: "Pages",
        tabs: ["all", "pages"],
        items: PAGE_ENTRIES.map((p) => ({
          id: `page-${p.to}`,
          label: p.label,
          icon: p.icon,
          onSelect: () => { navigate(p.to); closeMenu(); },
        })),
      });
    }

    // 4. Continue Watching
    push({
      id: "continue",
      label: "Continue Watching",
      tabs: ["all", "anime", "history"],
      items: (() => {
        const byAnime = new Map<number, typeof history[number]>();
        for (const h of history) {
          const ex = byAnime.get(h.animeId);
          if (!ex || h.updatedAt > ex.updatedAt) byAnime.set(h.animeId, h);
        }
        return Array.from(byAnime.values())
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 5)
          .map((item) => {
            const progress = item.duration > 0 ? Math.min(100, Math.round((item.timestamp / item.duration) * 100)) : 0;
            return {
              id: `cont-${item.animeId}-${item.episode}`,
              label: item.title,
              sublabel: `Ep ${item.episode} • ${progress}%`,
              thumbnail: item.coverImage,
              badge: "Resume",
              onSelect: () => { navigate(`/watch/${item.animeId}?ep=${item.episode}&t=${item.timestamp}`); closeMenu(); },
            };
          });
      })(),
    });

    // 5. Bookmarks (top 5 + expandable)
    {
      const visibleCount = bookmarksExpanded ? Math.min(bookmarks.length, 50) : Math.min(bookmarks.length, 5);
      push({
        id: "bookmarks",
        label: `Bookmarks · ${bookmarks.length}`,
        tabs: ["all", "anime", "history"],
        items: bookmarks.slice(0, visibleCount).map((b) => ({
          id: `bm-${b.animeId}`,
          label: b.title,
          thumbnail: b.coverImage,
          onSelect: () => { navigate(`/anime/${b.animeId}`); closeMenu(); },
        })),
        footer: bookmarks.length > 5 && !bookmarksExpanded
          ? { label: `Show all ${bookmarks.length}`, onClick: () => setBookmarksExpanded(true) }
          : null,
      });
    }

    // 6. Random Anime (under "Discover" — minimal)
    push({
      id: "random",
      label: "Discover",
      tabs: ["all", "actions", "anime"],
      items: [{
        id: "random-pick",
        label: randomLoading ? "Picking…" : "Surprise me — random anime",
        icon: Dice5,
        onSelect: pickRandom,
      }],
    });

    // 7. Trending Now (collapsible, open by default)
    push({
      id: "trending",
      label: "Trending Now",
      tabs: ["all", "anime"],
      collapsible: true,
      defaultCollapsed: false,
      items: (trending ?? []).map((a) => ({
        id: `tr-${a.id}`,
        label: getTitle(a.title),
        sublabel: [a.format, a.seasonYear].filter(Boolean).join(" • "),
        thumbnail: a.coverImage?.large,
        score: a.averageScore,
        onSelect: () => { navigate(`/anime/${a.id}`); closeMenu(); },
      })),
    });

    // 8. Browse by Genre (dropdown, closed by default)
    push({
      id: "genres",
      label: "Browse by Genre",
      tabs: ["all", "anime", "pages"],
      collapsible: true,
      defaultCollapsed: true,
      items: TOP_GENRES.map((g) => ({
        id: `genre-${g}`,
        label: g,
        icon: Hash,
        onSelect: () => { navigate(`/browse?genre=${encodeURIComponent(g)}`); closeMenu(); },
      })),
    });

    // 9. Season Shortcuts (dropdown, closed by default)
    push({
      id: "seasons",
      label: "Season Shortcuts",
      tabs: ["all", "anime", "pages"],
      collapsible: true,
      defaultCollapsed: true,
      items: seasonShortcuts.map((s) => ({
        id: `season-${s.label}`,
        label: s.label,
        icon: Calendar,
        onSelect: () => { navigate(`/browse?year=${s.year}`); closeMenu(); },
      })),
    });

    // 10. Airing Today (dropdown, closed by default, lazy-load on expand)
    push({
      id: "airing",
      label: airingLoading
        ? "Airing Today — loading…"
        : (airing !== null ? `Airing Today · ${airing.length}` : "Airing Today"),
      tabs: ["all", "anime"],
      collapsible: true,
      defaultCollapsed: true,
      onExpand: loadAiring,
      items: (airing ?? []).map((a) => ({
        id: `air-${a.id}`,
        label: getTitle(a.title),
        sublabel: (() => {
          const na = (a as { nextAiringEpisode?: { airingAt?: number; episode?: number } }).nextAiringEpisode;
          if (!na?.airingAt) return undefined;
          const diff = Math.max(0, Math.floor((na.airingAt * 1000 - Date.now()) / 60000));
          return `Ep ${na.episode ?? "?"} • in ${diff < 60 ? `${diff}m` : `${Math.floor(diff / 60)}h ${diff % 60}m`}`;
        })(),
        thumbnail: a.coverImage?.large,
        score: a.averageScore,
        onSelect: () => { navigate(`/anime/${a.id}`); closeMenu(); },
      })),
    });

    return out;
  }, [
    searchResults, searching, recentVisits, history, bookmarks, bookmarksExpanded,
    trending, airing, airingLoading, query, seasonShortcuts,
    navigate, closeMenu, pickRandom, loadAiring, randomLoading,
  ]);

  // ─── Filter by tab + collapse state ───
  const visibleSections = useMemo(() => {
    return allSections
      .filter((s) => s.tabs.includes(activeTab))
      .map((s) => {
        if (s.collapsible && collapsed[s.id]) {
          return { ...s, items: [], footer: null };
        }
        return s;
      });
  }, [allSections, activeTab, collapsed]);

  // ─── Flatten: header entry + item entries, per section ───
  // A "header" entry is always emitted for collapsible sections (even
  // when collapsed and items=[]) so the dropdown toggle remains
  // clickable. Non-collapsible sections only emit a header when they
  // have items.
  type FlatEntry =
    | { kind: "header"; sectionId: string; sectionLabel: string; index: number }
    | { kind: "item"; sectionId: string; sectionLabel: string; item: CmdItem; index: number };
  const flatItems = useMemo(() => {
    const flat: FlatEntry[] = [];
    let idx = 0;
    for (const s of visibleSections) {
      const hasItems = s.items.length > 0 || s.footer;
      if (s.collapsible || hasItems) {
        flat.push({ kind: "header", sectionId: s.id, sectionLabel: s.label, index: idx++ });
      }
      for (const item of s.items) {
        flat.push({ kind: "item", sectionId: s.id, sectionLabel: s.label, item, index: idx++ });
      }
      if (s.footer) {
        flat.push({
          kind: "item",
          sectionId: s.id,
          sectionLabel: s.label,
          item: { id: `${s.id}-footer`, label: s.footer.label, onSelect: s.footer.onClick },
          index: idx++,
        });
      }
    }
    return flat;
  }, [visibleSections]);

  /** Items only (for keyboard nav bounds + Enter). */
  const itemEntries = useMemo(
    () => flatItems.filter((e): e is Extract<FlatEntry, { kind: "item" }> => e.kind === "item"),
    [flatItems],
  );

  useEffect(() => { setActiveIndex(-1); }, [debouncedQuery, activeTab, searchResults.length, recentVisits.length]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex, open]);

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      // Move to next item entry (skip headers)
      const nextEntry = itemEntries.find((entry) => entry.index > activeIndex);
      if (nextEntry) setActiveIndex(nextEntry.index);
      else if (itemEntries.length > 0) setActiveIndex(itemEntries[0].index);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevEntry = [...itemEntries].reverse().find((entry) => entry.index < activeIndex);
      if (prevEntry) setActiveIndex(prevEntry.index);
      else if (itemEntries.length > 0) setActiveIndex(itemEntries[itemEntries.length - 1].index);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = flatItems.find((e) => e.index === activeIndex);
      if (entry && entry.kind === "item") entry.item.onSelect();
    }
  };

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeMenu} />

          {/* Palette — minimalistic: thinner border, less shadow, smaller radius */}
          <motion.div
            className="relative w-full max-w-xl rounded-xl bg-zinc-950/90 border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
            initial={{ scale: 0.97, opacity: 0, y: -6 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.97, opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Search input — minimal: single bottom border, smaller padding */}
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-white/10">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onListKeyDown}
                placeholder="Search or jump to…"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Tab bar — minimal: smaller height, no pills, just text + kbd */}
            <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/10 overflow-x-auto no-scrollbar">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setActiveTab(t.id); setActiveIndex(0); }}
                  className={`flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors flex-shrink-0 ${
                    activeTab === t.id
                      ? "text-foreground bg-white/5"
                      : "text-muted-foreground/70 hover:text-foreground"
                  }`}
                >
                  {t.label}
                  <span className={`text-[9px] font-mono ${activeTab === t.id ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                    {t.hotkey}
                  </span>
                </button>
              ))}
            </div>

            {/* Results — minimal: tighter padding, smaller items */}
            <div ref={listRef} className="overflow-y-auto py-1 flex-1">
              {itemEntries.length === 0 && flatItems.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <Search className="h-6 w-6 text-muted-foreground mx-auto mb-1.5 opacity-40" />
                  <p className="text-xs text-muted-foreground">
                    {query.trim() ? `No results for "${query}"` : "Nothing in this tab"}
                  </p>
                </div>
              ) : (
                flatItems.map((entry) => {
                  if (entry.kind === "header") {
                    const section = visibleSections.find((s) => s.id === entry.sectionId);
                    const isCollapsible = section?.collapsible;
                    const isCollapsed = !!collapsed[entry.sectionId];
                    return (
                      <div key={`hdr-${entry.sectionId}`} className="px-3 pt-2 pb-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            if (isCollapsible) toggleCollapse(entry.sectionId, section?.onExpand);
                          }}
                          className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 ${
                            isCollapsible ? "hover:text-foreground cursor-pointer" : "cursor-default"
                          }`}
                        >
                          {entry.sectionLabel}
                          {isCollapsible && (
                            <ChevronDown className={`h-3 w-3 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                          )}
                        </button>
                      </div>
                    );
                  }
                  // item entry
                  const isActive = entry.index === activeIndex;
                  const isFooter = entry.item.id.endsWith("-footer");
                  return (
                    <button
                      key={entry.item.id}
                      type="button"
                      data-idx={entry.index}
                      onClick={entry.item.onSelect}
                      onMouseEnter={() => setActiveIndex(entry.index)}
                      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                        isActive ? "bg-white/5" : "hover:bg-white/[0.03]"
                      } ${isFooter ? "text-[11px] text-muted-foreground hover:text-foreground" : ""}`}
                    >
                      {/* Thumbnail or icon — minimal: smaller, no ring */}
                      {entry.item.thumbnail ? (
                        <img
                          src={entry.item.thumbnail}
                          alt=""
                          loading="lazy"
                          className="w-6 h-8 rounded object-cover flex-shrink-0"
                          onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
                        />
                      ) : entry.item.icon ? (
                        <div className="w-6 h-8 rounded flex items-center justify-center flex-shrink-0">
                          <entry.item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="w-6 h-8 flex-shrink-0" />
                      )}

                      {/* Label + sublabel — minimal: smaller text */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-medium truncate ${isActive ? "text-foreground" : "text-foreground/90"}`}>
                          {entry.item.label}
                        </p>
                        {entry.item.sublabel && (
                          <p className="text-[10px] text-muted-foreground/70 truncate">{entry.item.sublabel}</p>
                        )}
                      </div>

                      {/* Status badge — minimal: smaller */}
                      {entry.item.badge && (
                        <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-xan-crimson/15 text-xan-crimson uppercase tracking-wider">
                          {entry.item.badge}
                        </span>
                      )}

                      {/* Score badge — minimal: smaller, no border */}
                      {entry.item.score != null && (
                        <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] font-medium text-yellow-500/90">
                          <Star className="h-2.5 w-2.5 fill-yellow-500/80 text-yellow-500/80" />
                          {Math.round(entry.item.score)}
                        </span>
                      )}

                      {/* Active indicator — minimal: just a dot */}
                      {isActive && !isFooter && (
                        <CornerDownLeft className="flex-shrink-0 h-3 w-3 text-muted-foreground/60" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer — minimal: single line, smaller text */}
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-white/10 text-[10px] text-muted-foreground/70">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-0.5">
                  <ArrowUp className="h-2.5 w-2.5" /><ArrowDown className="h-2.5 w-2.5" />
                </span>
                <span className="flex items-center gap-0.5">
                  <CornerDownLeft className="h-2.5 w-2.5" />
                </span>
                <span className="flex items-center gap-0.5">
                  <kbd className="px-1 py-0 rounded border border-white/10 font-mono text-[9px]">⌘1-5</kbd>
                </span>
                <span className="flex items-center gap-0.5">
                  <kbd className="px-1 py-0 rounded border border-white/10 font-mono text-[9px]">ESC</kbd>
                </span>
              </div>
              <span className="opacity-50">XAN</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
