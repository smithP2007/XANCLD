import { Link } from "react-router-dom";
import { Play, Github, Twitter, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-xan-border bg-background/50">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <Link to="/home" className="flex items-center gap-2 w-fit">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center">
                <Play className="h-3.5 w-3.5 text-white fill-white" />
              </div>
              <span className="font-display font-extrabold text-lg text-foreground">XAN</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              Stream anime without the noise. Discover, search, and watch your favorite titles
              powered by the AniList API.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Browse
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/home" className="text-foreground/80 hover:text-foreground transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/trending" className="text-foreground/80 hover:text-foreground transition-colors">
                    Discover
                  </Link>
                </li>
                <li>
                  <Link to="/schedule" className="text-foreground/80 hover:text-foreground transition-colors">
                    Schedule
                  </Link>
                </li>
                <li>
                  <Link to="/search" className="text-foreground/80 hover:text-foreground transition-colors">
                    Search
                  </Link>
                </li>
                <li>
                  <Link to="/history" className="text-foreground/80 hover:text-foreground transition-colors">
                    History
                  </Link>
                </li>
                <li>
                  <Link to="/list" className="text-foreground/80 hover:text-foreground transition-colors">
                    My Library
                  </Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                About
              </h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="https://anilist.co"
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground/80 hover:text-foreground transition-colors"
                  >
                    AniList API
                  </a>
                </li>
                <li>
                  <Link to="/trending" className="text-foreground/80 hover:text-foreground transition-colors">
                    Discover
                  </Link>
                </li>
                <li>
                  <Link to="/schedule" className="text-foreground/80 hover:text-foreground transition-colors">
                    Schedule
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Social */}
          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Connect
            </h4>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/smithP2007/XANCLD"
                target="_blank"
                rel="noreferrer"
                aria-label="GitHub"
                className="w-9 h-9 rounded-lg bg-xan-card hover:bg-xan-card-hover border border-xan-border flex items-center justify-center transition-colors"
              >
                <Github className="h-4 w-4 text-foreground/70" />
              </a>
              <a
                href="#"
                aria-label="Twitter"
                className="w-9 h-9 rounded-lg bg-xan-card hover:bg-xan-card-hover border border-xan-border flex items-center justify-center transition-colors"
              >
                <Twitter className="h-4 w-4 text-foreground/70" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-6 border-t border-xan-border flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} XAN. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Built with
            <Heart className="h-3 w-3 text-xan-crimson fill-xan-crimson" />
            and the AniList API
          </p>
        </div>
      </div>
    </footer>
  );
}
