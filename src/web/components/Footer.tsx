import { Link } from "react-router-dom";
import { Play, Github } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-xan-border mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-xan-crimson to-xan-violet flex items-center justify-center">
              <Play className="h-3.5 w-3.5 text-white fill-white" />
            </div>
            <span className="font-display font-extrabold text-lg">XAN</span>
            <span className="text-sm text-muted-foreground ml-2">
              Stream anime without the noise.
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/home" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <Link to="/trending" className="hover:text-foreground transition-colors">
              Trending
            </Link>
            <a
              href="https://github.com/smithP2007/XAN"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
            >
              <Github className="h-4 w-4" /> GitHub
            </a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t border-xan-border text-center text-xs text-muted-foreground">
          <p>
            Built with Hono + Vite + React on Cloudflare Workers. Data from AniList + AllAnime.
          </p>
          <p className="mt-1">
            For educational purposes only. Users are responsible for complying with local laws.
          </p>
        </div>
      </div>
    </footer>
  );
}
