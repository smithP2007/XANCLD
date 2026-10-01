import { useId } from "react";

/**
 * XAN "GUIDING LIGHT" logo — designed around the name SUNDEEP.
 *
 * SUNDEEP (Sanskrit सन्दीप) means "a lighted lamp / radiance" — a light that
 * guides through darkness. The mark tells that story:
 *
 *   • Four beams of light shoot outward in an X — the letter XAN.
 *   • At the center sits a four-point spark — the lamp flame itself
 *     (the "deep" in SUN-DEEP). Beam axes and spark points are offset
 *     by 45° so together they read as an eight-point radiance star.
 *   • A soft halo glows behind the spark; the brand rose→violet tile
 *     is the dusk the light rises from.
 *
 * The tile gradient reads the live theme tokens (--color-xan-crimson /
 * --color-xan-violet) so the mark re-skins with every theme preset,
 * exactly like the rest of the app. A static twin with the default
 * brand values lives in public/logo.svg (favicon).
 */

export function LogoMark({ className }: { className?: string }) {
  const raw = useId();
  // Sanitize: url(#id) references dislike the colons useId emits.
  const uid = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  const tile = `xan-tile-${uid}`;
  const sheen = `xan-sheen-${uid}`;
  const halo = `xan-halo-${uid}`;

  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="XAN logo" className={className}>
      <defs>
        {/* Brand tile — rose (top-left) → violet (bottom-right) */}
        <linearGradient id={tile} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--color-xan-crimson, #e94560)" }} />
          <stop offset="100%" style={{ stopColor: "var(--color-xan-violet, #7b2ff7)" }} />
        </linearGradient>
        {/* Glass sheen across the top half of the tile */}
        <linearGradient id={sheen} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        {/* Halo behind the lamp spark */}
        <radialGradient id={halo} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Tile */}
      <rect x="1" y="1" width="46" height="46" rx="13.5" fill={`url(#${tile})`} />
      <rect x="1" y="1" width="46" height="46" rx="13.5" fill={`url(#${sheen})`} />
      {/* Inner hairline — jewellery edge */}
      <rect
        x="1.9"
        y="1.9"
        width="44.2"
        height="44.2"
        rx="12.6"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.24"
        strokeWidth="1.4"
      />

      {/* Halo (under the beams so they emerge from the light) */}
      <circle cx="24" cy="24" r="11.5" fill={`url(#${halo})`} />

      {/* The four light beams — the X of XAN */}
      <g stroke="#ffffff" strokeWidth="4.2" strokeLinecap="round" fill="none">
        <path d="M17.6 17.6 12.4 12.4" />
        <path d="M30.4 17.6 35.6 12.4" />
        <path d="M17.6 30.4 12.4 35.6" />
        <path d="M30.4 30.4 35.6 35.6" />
      </g>

      {/* The lamp spark — SUNDEEP's flame, center of the mark */}
      <path
        d="M24 16.2 Q25.35 22.65 31.8 24 Q25.35 25.35 24 31.8 Q22.65 25.35 16.2 24 Q22.65 22.65 24 16.2 Z"
        fill="#ffffff"
      />
    </svg>
  );
}

/**
 * Full lockup — mark + XAN wordmark.
 * `wordClassName` controls text color per surface (text-white on the dark
 * Landing, text-foreground on token-driven surfaces).
 */
export function Logo({
  className,
  markClassName = "h-9 w-9 md:h-10 md:w-10",
  wordClassName = "text-foreground",
  wordSize = "md",
}: {
  className?: string;
  markClassName?: string;
  wordClassName?: string;
  wordSize?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "text-xl",
    md: "text-2xl md:text-3xl",
    lg: "text-3xl",
  } as const;
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark className={markClassName} />
      <span
        className={`font-display font-extrabold uppercase leading-none tracking-[-0.03em] ${sizes[wordSize]} ${wordClassName}`}
      >
        XAN
      </span>
    </span>
  );
}
