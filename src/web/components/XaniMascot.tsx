import type { ReactNode } from "react";

export type MascotMood = "happy" | "sad" | "sleepy" | "curious";

interface Props {
  mood?: MascotMood;
  /** Pixel size of the square mascot (width = height). Default 80. */
  size?: number;
  /** Optional className for the wrapper. */
  className?: string;
}

/**
 * XaniMascot — XAN's small mascot (a chibi cloud-fox creature).
 *
 * Per the redesign plan §3: use ONLY in empty states (no results, empty
 * library, empty history) and error states (playback failure, network
 * failure). Do NOT place it on every card, in the navbar, or as a
 * persistent chrome element — this keeps it charming rather than busy.
 *
 * Pure inline SVG so it:
 *   - Adds zero image requests
 *   - Inherits the active theme's accent colors via CSS variables
 *     (currentColor + var(--color-xan-crimson) / var(--color-xan-violet))
 *   - Scales crisply at any size
 *   - Respects prefers-reduced-motion (the only animation is a subtle float
 *     which the global reduced-motion CSS already kills)
 *
 * Mood variants:
 *   - happy:    default, smiling, used for empty states
 *   - sad:      frowning + a tear, used for error states
 *   - sleepy:   closed eyes + "z", used for empty history ("nothing here")
 *   - curious:  raised eyebrow, used for empty search results
 */
export function XaniMascot({ mood = "happy", size = 80, className }: Props) {
  return (
    <div
      className={`xani-mascot inline-flex items-center justify-center ${className ?? ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Soft ambient glow behind the mascot — uses theme accent */}
        <circle
          cx="50"
          cy="52"
          r="42"
          fill="var(--color-xan-crimson)"
          opacity="0.08"
        />

        {/* Body — rounded cloud-fox shape */}
        <ellipse
          cx="50"
          cy="58"
          rx="32"
          ry="28"
          fill="var(--color-xan-surface, #14141a)"
          stroke="var(--color-xan-crimson)"
          strokeWidth="2"
          opacity="0.95"
        />

        {/* Ears */}
        <path
          d="M28 38 L22 18 L38 32 Z"
          fill="var(--color-xan-surface, #14141a)"
          stroke="var(--color-xan-crimson)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M72 38 L78 18 L62 32 Z"
          fill="var(--color-xan-surface, #14141a)"
          stroke="var(--color-xan-crimson)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Inner ears — violet accent */}
        <path d="M28 34 L26 24 L34 31 Z" fill="var(--color-xan-violet)" opacity="0.55" />
        <path d="M72 34 L74 24 L66 31 Z" fill="var(--color-xan-violet)" opacity="0.55" />

        {/* Cheek blush — only on happy/curious moods */}
        {(mood === "happy" || mood === "curious") && (
          <>
            <circle cx="34" cy="62" r="4" fill="var(--color-xan-crimson)" opacity="0.35" />
            <circle cx="66" cy="62" r="4" fill="var(--color-xan-crimson)" opacity="0.35" />
          </>
        )}

        {/* Eyes */}
        {mood === "sleepy" ? (
          <>
            {/* Closed eyes — curved lines */}
            <path d="M36 52 Q40 56 44 52" stroke="var(--foreground, #fafafa)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            <path d="M56 52 Q60 56 64 52" stroke="var(--foreground, #fafafa)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            {/* Zzz */}
            <text x="70" y="32" fill="var(--color-xan-violet)" fontSize="11" fontWeight="700" fontFamily="Outfit, sans-serif">z</text>
            <text x="76" y="24" fill="var(--color-xan-violet)" fontSize="9" fontWeight="700" fontFamily="Outfit, sans-serif" opacity="0.7">z</text>
          </>
        ) : mood === "sad" ? (
          <>
            {/* Sad eyes — small dots + eyebrows angled down-in */}
            <circle cx="40" cy="54" r="2.5" fill="var(--foreground, #fafafa)" />
            <circle cx="60" cy="54" r="2.5" fill="var(--foreground, #fafafa)" />
            <path d="M34 47 L44 50" stroke="var(--foreground, #fafafa)" strokeWidth="2" strokeLinecap="round" />
            <path d="M66 47 L56 50" stroke="var(--foreground, #fafafa)" strokeWidth="2" strokeLinecap="round" />
            {/* Tear */}
            <path d="M60 58 Q58 64 60 68 Q62 64 60 58 Z" fill="var(--color-xan-violet)" opacity="0.7" />
          </>
        ) : (
          <>
            {/* Happy / curious eyes — rounded dots */}
            <circle cx="40" cy="54" r="3.5" fill="var(--foreground, #fafafa)" />
            <circle cx="60" cy="54" r="3.5" fill="var(--foreground, #fafafa)" />
            {/* Eye sparkle */}
            <circle cx="41.5" cy="52.5" r="1" fill="var(--color-xan-crimson)" opacity="0.8" />
            <circle cx="61.5" cy="52.5" r="1" fill="var(--color-xan-crimson)" opacity="0.8" />
            {mood === "curious" && (
              <>
                {/* One raised eyebrow */}
                <path d="M34 48 Q40 45 46 48" stroke="var(--foreground, #fafafa)" strokeWidth="2" fill="none" strokeLinecap="round" />
              </>
            )}
          </>
        )}

        {/* Mouth */}
        {mood === "happy" && (
          <path d="M44 66 Q50 72 56 66" stroke="var(--foreground, #fafafa)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        )}
        {mood === "curious" && (
          <circle cx="50" cy="68" r="2" fill="var(--foreground, #fafafa)" />
        )}
        {mood === "sad" && (
          <path d="M44 70 Q50 64 56 70" stroke="var(--foreground, #fafafa)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        )}
        {/* sleepy mouth is just a small line */}
        {mood === "sleepy" && (
          <path d="M47 68 L53 68" stroke="var(--foreground, #fafafa)" strokeWidth="2.2" strokeLinecap="round" />
        )}

        {/* Tail — small swirl on the right side */}
        <path
          d="M82 60 Q88 56 86 50 Q84 46 80 48"
          stroke="var(--color-xan-crimson)"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/** Convenience wrapper: mascot + optional caption text below. */
export function XaniWithCaption({
  mood,
  size = 80,
  caption,
  className,
}: {
  mood?: MascotMood;
  size?: number;
  caption?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center ${className ?? ""}`}>
      <XaniMascot mood={mood} size={size} />
      {caption && <div className="mt-3 text-center">{caption}</div>}
    </div>
  );
}
