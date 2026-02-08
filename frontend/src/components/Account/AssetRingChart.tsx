import { useEffect, useRef, useState, useId } from 'react';

interface Segment {
  label: string;
  value: number;
  color: string;
}

interface AssetRingChartProps {
  segments: Segment[];
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * ── Asset Allocation Ring Chart ──────────────────────────────────
 *
 * Animation — single unified sweep reveal:
 *   All colored arcs are drawn at their final state. A single SVG
 *   <mask> circle uses stroke-dasharray driven by a progress value
 *   p ∈ [0,1] to reveal the ring clockwise from 12-o'clock. One
 *   continuous motion, not per-segment.
 *
 * Metallic / sheen effect:
 *   Two transparent overlay circles sit on top of all segments
 *   (inside the same mask group). A "sheen" linearGradient goes
 *   from subtle white (upper-left highlight) to subtle black
 *   (lower-right shadow). A "specular" gradient adds a thin glint
 *   band diagonally across the ring. Both are very low opacity so
 *   the effect is premium, not gaudy.
 *
 * Segment caps are strokeLinecap="butt" for crisp straight edges.
 *
 * ── Tweaking ──
 *   Duration / easing → DURATION_MS, easeOut()
 *   Gap between arcs  → GAP_DEG
 *   Sheen strength    → HIGHLIGHT_OPACITY, SHADOW_OPACITY
 *   Specular glint    → SPECULAR_OPACITY
 * ─────────────────────────────────────────────────────────────────
 */

/* ── Tunables ─────────────────────────────────────────────────── */
const DURATION_MS = 1050; // sweep duration (tweak: 900–1200ms)
const GAP_DEG = 2; // degrees of empty gap between segments

// Gradient intensity — raise for more metallic pop, lower for subtler
const HIGHLIGHT_OPACITY = 0.16; // white highlight (upper-left)
const SHADOW_OPACITY = 0.12; // dark shadow (lower-right)
const SPECULAR_OPACITY = 0.09; // thin glint band peak

/** Cubic ease-out: fast start, gentle settle */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Sanitize useId() output (may contain colons) so it's safe inside url(#id) */
function safeId(raw: string): string {
  return raw.replace(/:/g, '_');
}

export function AssetRingChart({
  segments,
  size = 160,
  strokeWidth = 18,
  className,
}: AssetRingChartProps) {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number>(0);
  const rawId = useId();
  const uid = safeId(rawId);

  // Scoped SVG IDs to avoid collisions when multiple rings exist
  const maskId = `${uid}-mask`;
  const sheenId = `${uid}-sheen`;
  const specId = `${uid}-spec`;

  useEffect(() => {
    setProgress(0);
    const start = performance.now();

    function tick(now: number) {
      const elapsed = now - start;
      const t = Math.min(elapsed / DURATION_MS, 1);
      setProgress(easeOut(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    // One frame delay so the 0-state renders first, then begin sweep
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(rafRef.current);
  }, [segments]);

  /* ── Bail early if empty ──────────────────────────────────── */
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div className={className} style={{ width: size, height: size }}>
        <p className="text-xs text-muted-foreground flex items-center justify-center h-full">
          No data
        </p>
      </div>
    );
  }

  /* ── Geometry ─────────────────────────────────────────────── */
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const gapFraction = GAP_DEG / 360;
  const activeSegments = segments.filter((s) => s.value > 0);
  const totalGap = gapFraction * activeSegments.length;

  /* ── Build final-state arcs ───────────────────────────────── */
  let accumulated = 0;
  const arcs = activeSegments.map((segment) => {
    const fraction = (segment.value / total) * (1 - totalGap);
    const dashLen = fraction * circumference;
    const dashGap = circumference - dashLen;
    const rotationDeg = accumulated * 360 - 90; // start at 12-o'clock
    accumulated += fraction + gapFraction;

    return { key: segment.label, color: segment.color, dashLen, dashGap, rotationDeg };
  });

  /* ── Sweep mask: reveal p × circumference ─────────────────── */
  const revealLen = progress * circumference;
  const revealGap = circumference - revealLen;

  return (
    <div className={className} style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          {/*
           * ── Sweep mask ──
           * A single white-stroked circle whose dasharray grows from
           * 0 → circumference. Everything inside the <g mask=...> group
           * is only visible where this white stroke exists, creating
           * the unified clockwise reveal.
           */}
          <mask id={maskId}>
            <rect x="0" y="0" width={size} height={size} fill="black" />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="white"
              strokeWidth={strokeWidth + 2} /* +2px avoids sub-pixel edge gaps */
              strokeDasharray={`${revealLen} ${revealGap}`}
              transform={`rotate(-90 ${center} ${center})`}
            />
          </mask>

          {/*
           * ── Metallic sheen gradient ──
           * Runs diagonally upper-left → lower-right.
           * White highlight at top-left, transparent middle, dark shadow
           * at bottom-right. Gives each segment a subtle 3D metallic feel.
           * Tweak: adjust HIGHLIGHT_OPACITY / SHADOW_OPACITY above.
           */}
          <linearGradient id={sheenId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity={HIGHLIGHT_OPACITY} />
            <stop offset="50%" stopColor="white" stopOpacity={0} />
            <stop offset="100%" stopColor="black" stopOpacity={SHADOW_OPACITY} />
          </linearGradient>

          {/*
           * ── Specular highlight band ──
           * A thin, soft white glint running across the ring at ~35%.
           * Mimics a single light-source reflection on polished metal.
           * Tweak: adjust SPECULAR_OPACITY above, or shift offsets.
           */}
          <linearGradient id={specId} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity={0} />
            <stop offset="28%" stopColor="white" stopOpacity={0} />
            <stop offset="35%" stopColor="white" stopOpacity={SPECULAR_OPACITY} />
            <stop offset="42%" stopColor="white" stopOpacity={0} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Background track (always visible, never masked) */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />

        {/*
         * ── Masked group ──
         * Contains: colored segments → sheen overlay → specular overlay.
         * All three layers are clipped by the single sweep mask so the
         * metallic effect appears progressively with the reveal.
         */}
        <g mask={`url(#${maskId})`}>
          {/* Flat-color segments — butt linecap for crisp straight edges */}
          {arcs.map((arc) => (
            <circle
              key={arc.key}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dashLen} ${arc.dashGap}`}
              strokeLinecap="butt"
              transform={`rotate(${arc.rotationDeg} ${center} ${center})`}
            />
          ))}

          {/* Sheen overlay — subtle highlight-to-shadow across full ring */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#${sheenId})`}
            strokeWidth={strokeWidth}
          />

          {/* Specular overlay — thin glint band */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={`url(#${specId})`}
            strokeWidth={strokeWidth}
          />
        </g>
      </svg>

      {/* Center label — fades in once the sweep is ~15% done */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ease-out"
        style={{ opacity: progress > 0.15 ? 1 : 0 }}
      >
        <p className="text-xs text-muted-foreground">Total</p>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          }).format(total)}
        </p>
      </div>
    </div>
  );
}
