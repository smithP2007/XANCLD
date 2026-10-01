import { Link } from "react-router-dom";
import { Play, Heart } from "lucide-react";

// B8: lucide-react 1.x removed brand icons (Github/Twitter/etc.). Inline the
// GitHub mark; the dead href="#" Twitter link is removed entirely.
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

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
                <GithubIcon className="h-4 w-4 text-foreground/70" />
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
