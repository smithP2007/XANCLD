import { Link } from "react-router-dom";
import {
  Zap,
  Compass,
  Laugh,
  Clapperboard,
  Sparkles,
  Ghost,
  Eye,
  Heart,
  Rocket,
  Trophy,
  type LucideIcon,
} from "lucide-react";

interface Mood {
  genre: string;
  icon: LucideIcon;
  hue: string;
}

// One-tap genre jumps — each chip deep-links straight into the search page
// with the genre pre-filtered (`/search?genres=…`), so the home page doubles
// as a mood selector. Every genre gets its own accent hue via the --chip
// CSS variable (hover glow picks it up automatically); hues stay inside the
// app's jewel-tone family so the row reads as part of the ROSA palette.
const MOODS: Mood[] = [
  { genre: "Action", icon: Zap, hue: "#e94560" },
  { genre: "Adventure", icon: Compass, hue: "#f59e0b" },
  { genre: "Comedy", icon: Laugh, hue: "#facc15" },
  { genre: "Drama", icon: Clapperboard, hue: "#fb7185" },
  { genre: "Fantasy", icon: Sparkles, hue: "#a855f7" },
  { genre: "Horror", icon: Ghost, hue: "#a3a3b8" },
  { genre: "Mystery", icon: Eye, hue: "#818cf8" },
  { genre: "Romance", icon: Heart, hue: "#f472b6" },
  { genre: "Sci-Fi", icon: Rocket, hue: "#22d3ee" },
  { genre: "Sports", icon: Trophy, hue: "#34d399" },
];

export function MoodChips() {
  return (
    // v4.4.3 GLOW-CLIP FIX — the hover glow is a COLORED box-shadow
    // (`0 6px 22px` in .mood-chip:hover): it paints ~17px below the chip
    // (6px y-offset + 11px blur radius) and ~7px above (5px blur tail +
    // 2px hover lift). A scroll container (`overflow-x: auto` → computed
    // `overflow-y: auto`) clips at its PADDING box, so the old pt-2/pb-2
    // (8px) sheared the bottom of the glow off with a hard horizontal
    // line (visible on <md where the row scrolls). pt-3 (12px) covers the
    // top with margin; pb-5 (20px) covers the full 17px bottom extent.
    // Spacing parity, zero layout shift: mt-2+pt-3 = 20px = old mt-5;
    // pb-5−mb-4 = 4px = old pb-1. mask-fade-r-desktop-none kills the
    // right-edge fade at md+, where the row wraps and nothing scrolls
    // (the fade was dimming "Sci-Fi").
    <div
      className="no-scrollbar -mx-4 mt-2 -mb-4 flex gap-2 overflow-x-auto px-4 pt-3 pb-5 mask-fade-r mask-fade-r-desktop-none md:mx-0 md:flex-wrap md:px-0"
      role="navigation"
      aria-label="Browse by mood"
    >
      {MOODS.map(({ genre, icon: Icon, hue }) => (
        <Link
          key={genre}
          to={`/search?genres=${encodeURIComponent(genre)}`}
          className="mood-chip inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold"
          style={{ "--chip": hue } as React.CSSProperties}
        >
          <Icon className="h-3.5 w-3.5" />
          {genre}
        </Link>
      ))}
    </div>
  );
}
