import { memo } from "react";
import type { EnhancerState } from "../hooks/useVideoEnhancer";

// Renders an invisible inline-SVG <defs> block containing the dynamic
// `xan-enhancer` filter used by the <video> / <iframe> element.
//
// The filter chains two primitives:
//   1. <feComponentTransfer type="gamma" exponent={gamma}> — gamma correction
//   2. <feConvolveMatrix> — sharpen convolution (3x3 kernel)
//
// The SVG is rendered as a 0x0 hidden block — the filter is referenced by
// the <video>/<iframe> via `filter: url(#xan-enhancer)`. No visual footprint.

interface VideoEnhancerFiltersProps {
  state: EnhancerState;
}

function VideoEnhancerFiltersInner({ state }: VideoEnhancerFiltersProps) {
  const { gamma, sharpen } = state;

  // Scale sharpen (0–100) → kernel amount s (0–1)
  // s=0 → identity kernel; s=1 → strong sharpen (center=5, sides=-1)
  const s = Math.max(0, Math.min(1, sharpen / 100));
  const center = 1 + 4 * s;
  const side = -s;
  const kernel = `0 ${side.toFixed(4)} 0 ${side.toFixed(4)} ${center.toFixed(4)} ${side.toFixed(4)} 0 ${side.toFixed(4)} 0`;
  const exponent = gamma.toFixed(3);

  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        left: 0,
        top: 0,
        pointerEvents: "none",
        opacity: 0,
      }}
    >
      <defs>
        <filter id="xan-enhancer" colorInterpolationFilters="sRGB">
          {/* Gamma correction — applied to R/G/B channels. exponent=1 = identity. */}
          <feComponentTransfer>
            <feFuncR type="gamma" exponent={exponent} amplitude="1" offset="0" />
            <feFuncG type="gamma" exponent={exponent} amplitude="1" offset="0" />
            <feFuncB type="gamma" exponent={exponent} amplitude="1" offset="0" />
            <feFuncA type="identity" />
          </feComponentTransfer>
          {/* Sharpen convolution — 3x3 kernel, only when s > 0 */}
          {s > 0 && (
            <feConvolveMatrix
              order="3"
              kernelMatrix={kernel}
              divisor={1}
              bias={0}
              targetX={1}
              targetY={1}
              edgeMode="duplicate"
              preserveAlpha={true}
            />
          )}
        </filter>
      </defs>
    </svg>
  );
}

export const VideoEnhancerFilters = memo(VideoEnhancerFiltersInner);
