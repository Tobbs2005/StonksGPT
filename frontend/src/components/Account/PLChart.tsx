import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineSeries,
  type IChartApi,
} from 'lightweight-charts';

/* ── Types ────────────────────────────────────────────────── */

export const VALID_RANGES = ['1D', '1W', '1M', '3M', 'YTD'] as const;
export type TimeRange = (typeof VALID_RANGES)[number];
export const DEFAULT_RANGE: TimeRange = 'YTD';

/** A single data point for the chart (unix seconds + value). */
export interface PLDataPoint {
  time: number;
  value: number;
}

interface PLChartProps {
  /** Pre-built time-series data (timestamps in unix seconds). */
  data: PLDataPoint[];
  /** Active time range — controls x-axis time visibility. */
  range: TimeRange;
  /** Chart container height in px. */
  height?: number;
}

/**
 * Map a frontend TimeRange to Alpaca API params.
 *   period   – window length Alpaca understands
 *   timeframe – data resolution per point
 */
export function rangeToApiParams(range: TimeRange): { period: string; timeframe: string } {
  switch (range) {
    case '1D':
      return { period: '1D', timeframe: '15Min' };
    case '1W':
      return { period: '1W', timeframe: '1H' };
    case '1M':
      return { period: '1M', timeframe: '1D' };
    case '3M':
      return { period: '3M', timeframe: '1D' };
    case 'YTD': {
      // Alpaca doesn't have a "YTD" period — use start=Jan 1 of current year
      // Caller should use `start` instead of `period`
      return { period: '', timeframe: '1D' };
    }
  }
}

/* ── Helpers ──────────────────────────────────────────────── */

function getThemeColors() {
  if (typeof window === 'undefined') {
    return {
      background: 'transparent',
      text: '#64748b',
      grid: 'rgba(148,163,184,0.08)',
      border: 'rgba(148,163,184,0.15)',
    };
  }
  const s = getComputedStyle(document.documentElement);
  const mf = s.getPropertyValue('--muted-foreground').trim() || '215.4 16.3% 46.9%';
  const fg = s.getPropertyValue('--foreground').trim() || '222.2 84% 4.9%';
  return {
    background: 'transparent',
    text: `hsl(${fg})`,
    grid: `hsl(${mf} / 0.08)`,
    border: `hsl(${mf} / 0.15)`,
  };
}

/* ── Component ────────────────────────────────────────────── */

/**
 * A single lightweight-charts line chart instance.
 *
 * Creates a chart on mount and destroys it on unmount. Uses
 * ResizeObserver for responsive width and a MutationObserver
 * for theme changes. Safe to mount/unmount rapidly (crossfade).
 */
export function PLChart({ data, range, height = 280 }: PLChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || data.length === 0) return;

    const theme = getThemeColors();
    const isPositive = data.length >= 2 && data[data.length - 1].value >= data[0].value;

    const chart: IChartApi = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: theme.background },
        textColor: theme.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: theme.grid },
        horzLines: { color: theme.grid },
      },
      timeScale: {
        borderColor: theme.border,
        timeVisible: range === '1D' || range === '1W',
      },
      rightPriceScale: { borderColor: theme.border },
      height,
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(LineSeries, {
      color: isPositive ? '#26a69a' : '#ef5350',
      lineWidth: 2,
      crosshairMarkerRadius: 4,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    series.setData(data);
    chart.timeScale().fitContent();

    /* ── resize observer ────────────────────────────────── */
    const ro = new ResizeObserver((entries) => {
      if (!entries.length) return;
      const { width } = entries[0].contentRect;
      if (width > 0) chart.applyOptions({ width });
    });
    ro.observe(el);

    /* ── theme observer (dark/light toggle) ──────────────── */
    const mo = new MutationObserver(() => {
      const t = getThemeColors();
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: t.background },
          textColor: t.text,
        },
        grid: {
          vertLines: { color: t.grid },
          horzLines: { color: t.grid },
        },
        timeScale: { borderColor: t.border },
        rightPriceScale: { borderColor: t.border },
      });
    });
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    /* ── cleanup ─────────────────────────────────────────── */
    return () => {
      mo.disconnect();
      ro.disconnect();
      chart.remove();
    };
  }, [data, range, height]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No portfolio data
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
