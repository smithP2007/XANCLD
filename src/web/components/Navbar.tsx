import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Play, Search, Settings, Home as HomeIcon, TrendingUp, Calendar, History } from "lucide-react";

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const isActive = (path: string) => {
    if (path === "/home") return location.pathname === "/home" || location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { to: "/home", label: "Home", icon: HomeIcon },
    { to: "/trending", label: "Trending", icon: TrendingUp },
    { to: "/schedule", label: "Schedule", icon: Calendar },
    { to: "/history", label: "History", icon: History },
  ];

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-500 ${
        scrolled
          ? "glass-strong border-xan-border"
          : "bg-transparent border-transparent"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link to="/home" className="flex items-center gap-2 group flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-xan-crimson/20">
            <Play className="h-4 w-4 text-white fill-white" />
          </div>
          <span className="font-display font-extrabold text-xl text-foreground tracking-tight">XAN</span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-xan-card/50 backdrop-blur-sm">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                isActive(link.to)
                  ? "text-foreground bg-xan-card-hover shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-xan-card"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Search + Settings */}
        <div className="flex items-center gap-2">
          <form onSubmit={onSubmit} className="hidden md:flex items-center relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none group-focus-within:text-xan-crimson transition-colors" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anime..."
              className="w-48 lg:w-64 pl-9 pr-4 py-2 rounded-xl bg-xan-card/50 backdrop-blur-sm border border-xan-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-xan-crimson/50 focus:bg-xan-card-hover focus:w-72 lg:focus:w-80 transition-all duration-300"
            />
          </form>
          <Link
            to="/settings"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-xan-card transition-all duration-300 hover:rotate-90"
            title="Settings"
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>
      </nav>
    </header>
  );
}
