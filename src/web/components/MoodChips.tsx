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
    // v4.4.1 HOVER-CLIP FIX — same padding-box rule as the card rows:
    // `overflow-x-auto` computes overflow-y to auto, so the hover lift
    // (-2px) and glow ring were clipped top & bottom. pt-2/pb-2 give the
    // box 8px of breathing room; mt-3+pt-2 (12+8=20) and pb-2-mb-1 (8-4=4)
    // reproduce the old mt-5/pb-1 spacing exactly — zero layout shift.
    // mask-fade-r-desktop-none kills the right-edge fade at md+, where the
    // row wraps and nothing scrolls (the fade was dimming "Sci-Fi").
    <div
      className="no-scrollbar -mx-4 mt-3 -mb-1 flex gap-2 overflow-x-auto px-4 pt-2 pb-2 mask-fade-r mask-fade-r-desktop-none md:mx-0 md:flex-wrap md:px-0"
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
