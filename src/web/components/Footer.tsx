import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { LogoMark } from "./Logo";

// B8: lucide-react 1.x removed brand icons (Github/Twitter/etc.). Inline the
// GitHub mark; the dead href="#" Twitter link is removed entirely.
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

const FOOTER_LINKS = [
  { label: "Home", to: "/home" },
  { label: "Discover", to: "/trending" },
  { label: "Schedule", to: "/schedule" },
  { label: "Search", to: "/search" },
  { label: "History", to: "/history" },
  { label: "My Library", to: "/list" },
];

// v4 ROSA: footer REPOSITIONED from a 3-column grid to a centered editorial
// layout — brand block, pill-chip nav links, social chips, then the legal
// row. Gradient hairline divider on top (signature rose→violet).
export function Footer() {
  return (
    <footer className="aurora-hairline mt-auto border-t border-xan-border">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-7 px-4 py-14 text-center md:px-6">
        {/* Brand block */}
        <div className="space-y-2.5">
          <Link to="/home" className="inline-flex items-center gap-2.5">
            <LogoMark className="h-9 w-9 rounded-[11px] shadow-lg shadow-xan-crimson/20" />
            <span className="font-display text-3xl font-extrabold uppercase tracking-[-0.03em] text-foreground">
              XAN
            </span>
          </Link>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            Stream anime without the noise. Discover, search, and watch your favorite
            titles powered by the AniList API.
          </p>
        </div>

        {/* Nav links as pill chips (new form) */}
        <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Footer">
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="flex h-9 items-center rounded-full border border-xan-border bg-xan-card px-4 text-[13px] font-bold text-foreground/75 transition-all hover:border-xan-crimson/50 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Social chips */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/smithP2007/XANCLD"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-xan-border bg-xan-card text-foreground/70 transition-all hover:border-xan-crimson/50 hover:text-foreground"
          >
            <GithubIcon className="h-4.5 w-4.5" />
          </a>
          <a
            href="https://anilist.co"
            target="_blank"
            rel="noreferrer"
            className="flex h-10 items-center rounded-full border border-xan-border bg-xan-card px-4 text-[13px] font-bold text-foreground/70 transition-all hover:border-xan-crimson/50 hover:text-foreground"
          >
            AniList API
          </a>
        </div>

        {/* Bottom row */}
        <div className="flex w-full flex-col items-center justify-between gap-2 border-t border-xan-border pt-6 text-xs text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} XAN. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Built with
            <Heart className="h-3 w-3 fill-xan-crimson text-xan-crimson" />
            and the AniList API
          </p>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60">
            XAN Rosa
          </p>
        </div>
      </div>
    </footer>
  );
}
