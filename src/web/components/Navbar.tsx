import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Search,
  Settings,
  X,
  Home as HomeIcon,
  Compass,
  Calendar,
  History as HistoryIcon,
  Library,
  Command,
} from "lucide-react";
import { openCommandMenu } from "./command/CommandMenu";
import { LogoMark } from "./Logo";

// v4 ROSA: navigation REPOSITIONED from a full-width top bar to a floating
// left sidebar rail on desktop. Mobile keeps a slim top bar for actions and
// gains a floating icon-only capsule dock at the bottom.
// v4.1 MINIMAL (user request): the desktop rail is now ICON-ONLY — no text
// labels. Width shrinks 216px → 68px; labels live in hover tooltips +
// aria-labels. The full-width search input is gone: the Search icon opens
// the ⌘K Command Menu, which already has live AniList search built in.
const RAIL_LINKS = [
  { label: "Home", to: "/home", icon: HomeIcon },
  { label: "Discover", to: "/trending", icon: Compass },
  { label: "Schedule", to: "/schedule", icon: Calendar },
  { label: "Library", to: "/list", icon: Library },
  { label: "History", to: "/history", icon: HistoryIcon },
];

const DOCK_LINKS = [
  { label: "Home", to: "/home", icon: HomeIcon },
  { label: "Discover", to: "/trending", icon: Compass },
  { label: "Schedule", to: "/schedule", icon: Calendar },
  { label: "Library", to: "/list", icon: Library },
  { label: "Settings", to: "/settings", icon: Settings },
];

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll, { passive: true } as never);
  }, []);

  // Close mobile search on route change
  useEffect(() => {
    setSearchOpen(false);
  }, [location.pathname]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setSearchOpen(false);
      setQuery("");
    } else {
      setSearchOpen(false);
    }
  };

  const isActive = (path: string) => {
    if (path === "/home") return location.pathname === "/home" || location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* ─── v4.1: Desktop MINIMAL icon-only sidebar rail (no labels) ─── */}
      <aside className="side-rail fixed left-4 top-4 bottom-4 z-50 hidden w-[68px] flex-col items-center p-3 md:flex">
        {/* "Guiding Light" mark (compact wordmark replacement) */}
        <Link
          to="/home"
          className="mb-2 flex-shrink-0 transition-transform duration-300 hover:scale-105"
          aria-label="XAN home"
          title="XAN"
        >
          <LogoMark className="h-10 w-10 rounded-[13px] shadow-lg shadow-xan-crimson/30" />
        </Link>

        {/* Search — icon button that opens the ⌘K Command Menu (live search) */}
        <button
          type="button"
          onClick={openCommandMenu}
          className="side-link"
          data-tip="Search · ⌘K"
          aria-label="Search anime (opens command menu)"
          title="Search"
        >
          <Search className="h-5 w-5" strokeWidth={2} />
        </button>

        {/* Primary links — icon only, labels on hover */}
        <nav className="flex flex-1 flex-col items-center gap-1 pt-1" aria-label="Primary">
          {RAIL_LINKS.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`side-link ${active ? "side-link--active" : ""}`}
                data-tip={link.label}
                aria-label={link.label}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              </Link>
            );
          })}
        </nav>

        {/* Footer of the rail — command + settings (icon only) */}
        <div className="mt-2 flex w-full flex-col items-center gap-1 border-t border-xan-border pt-3">
          <button
            type="button"
            onClick={openCommandMenu}
            className="side-link"
            data-tip="Command · ⌘K"
            aria-label="Open command menu (⌘K)"
            title="Command menu"
          >
            <Command className="h-5 w-5" />
          </button>
          <Link
            to="/settings"
            className={`side-link ${isActive("/settings") ? "side-link--active" : ""}`}
            data-tip="Settings"
            aria-label="Settings"
            aria-current={isActive("/settings") ? "page" : undefined}
          >
            <Settings className="h-5 w-5" strokeWidth={isActive("/settings") ? 2.4 : 2} />
          </Link>
        </div>
      </aside>

      {/* ─── Mobile slim top bar ─── */}
      <header className={`nav-pill fixed left-0 right-0 top-0 z-50 pointer-events-none md:hidden ${scrolled ? "nav-pill--scrolled" : ""}`}>
        <div className="pointer-events-auto flex h-14 items-center justify-between gap-2 px-4">
          <Link to="/home" className="flex flex-shrink-0 items-center gap-2">
            <LogoMark className="h-7 w-7 rounded-lg" />
            <span className="font-display text-xl font-extrabold uppercase tracking-[-0.03em] text-foreground">
              XAN
            </span>
          </Link>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={openCommandMenu}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Open command menu"
            >
              <Command className="h-4.5 w-4.5" />
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Toggle search"
            >
              {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search panel */}
        {searchOpen && (
          <div className="pointer-events-auto px-4 pb-2 animate-fade-in md:hidden">
            <form onSubmit={onSubmit} className="glass-strong relative flex items-center rounded-full">
              <Search className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search anime…"
                autoFocus
                className="h-11 w-full bg-transparent pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </form>
          </div>
        )}
      </header>

      {/* ─── v4: Mobile floating capsule dock (icon-only, new form) ─── */}
      <nav
        className="dock fixed bottom-3 left-4 right-4 z-50 flex items-stretch md:hidden"
        aria-label="Primary"
      >
        {DOCK_LINKS.map((link) => {
          const Icon = link.icon;
          const active = isActive(link.to);
          return (
            <Link
              key={link.to}
              to={link.to}
              aria-label={link.label}
              className={`dock-item ${active ? "dock-item--active" : ""}`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
            </Link>
          );
        })}
      </nav>
    </>
  );
}
