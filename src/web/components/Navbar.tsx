import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  Play,
  Search,
  Settings,
  Menu,
  X,
  Home as HomeIcon,
  Compass,
  Calendar,
  History as HistoryIcon,
  Library,
} from "lucide-react";

const NAV_LINKS = [
  { label: "Home", to: "/home", icon: HomeIcon },
  { label: "Discover", to: "/trending", icon: Compass },
  { label: "Schedule", to: "/schedule", icon: Calendar },
  { label: "My Library", to: "/list", icon: Library },
  { label: "History", to: "/history", icon: HistoryIcon },
];

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
      setSearchOpen(false);
      setMobileOpen(false);
      setQuery("");
    }
  };

  const isActive = (path: string) => {
    if (path === "/home") return location.pathname === "/home" || location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-background/80 backdrop-blur-xl border-b border-xan-border"
          : "bg-transparent border-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center group-hover:scale-105 transition-transform">
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
          <span className="font-display font-extrabold text-xl text-foreground">XAN</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.to)
                  ? "text-foreground bg-xan-card-hover"
                  : "text-muted-foreground hover:text-foreground hover:bg-xan-card"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Search + actions */}
        <div className="flex items-center gap-2">
          {/* Desktop search */}
          <form onSubmit={onSubmit} className="hidden md:flex items-center relative">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anime..."
              className="pl-9 w-48 lg:w-64 rounded-lg bg-xan-card border border-xan-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50 focus:ring-2 focus:ring-xan-crimson/30 h-9"
            />
          </form>

          {/* Settings (desktop) */}
          <Link
            to="/settings"
            className={`hidden md:flex w-9 h-9 items-center justify-center rounded-lg transition-colors ${
              location.pathname === "/settings"
                ? "text-foreground bg-xan-card-hover"
                : "text-muted-foreground hover:text-foreground hover:bg-xan-card"
            }`}
            aria-label="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>

          {/* Mobile search toggle */}
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-xan-card transition-colors"
            aria-label="Toggle search"
          >
            {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
          </button>

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-xan-card transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile search panel */}
      {searchOpen && (
        <div className="md:hidden overflow-hidden border-t border-xan-border bg-background animate-fade-in">
          <form onSubmit={onSubmit} className="px-4 py-3 flex items-center relative">
            <Search className="absolute left-7 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anime..."
              autoFocus
              className="pl-9 w-full rounded-lg bg-xan-card border border-xan-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50 h-10"
            />
          </form>
        </div>
      )}

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="md:hidden overflow-hidden border-t border-xan-border bg-background animate-fade-in">
          <div className="px-4 py-3 flex flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${
                    isActive(link.to)
                      ? "text-foreground bg-xan-card-hover"
                      : "text-muted-foreground hover:text-foreground hover:bg-xan-card"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
            <Link
              to="/settings"
              className={`px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors border-t border-xan-border mt-2 pt-3 ${
                location.pathname === "/settings"
                  ? "text-foreground bg-xan-card-hover"
                  : "text-muted-foreground hover:text-foreground hover:bg-xan-card"
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
