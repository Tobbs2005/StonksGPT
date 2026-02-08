import { useState, useEffect, useRef } from 'react';
import { PLChart, type TimeRange, type PLDataPoint } from './PLChart';

/**
 * Crossfade wrapper for PLChart.
 *
 * Stacks TWO chart instances during a range transition so the old
 * one fades out while the new one fades in. After the transition,
 * the old chart is unmounted (calling chart.remove() in PLChart's
 * cleanup) to free resources.
 */

const FADE_MS = 280;

interface Layer {
  range: TimeRange;
  data: PLDataPoint[];
  key: number;
  opacity: number;
}

interface CrossfadePLChartProps {
  data: PLDataPoint[];
  range: TimeRange;
  height?: number;
}

export function CrossfadePLChart({ data, range, height = 280 }: CrossfadePLChartProps) {
  const [layers, setLayers] = useState<Layer[]>([
    { range, data, key: 0, opacity: 1 },
  ]);
  const keyRef = useRef(0);
  const rafRef = useRef(0);
  const timerRef = useRef(0);

  useEffect(() => {
    const top = layers[layers.length - 1];
    // Trigger crossfade when range OR data identity changes
    if (top.range === range && top.data === data) return;

    keyRef.current += 1;
    const newKey = keyRef.current;

    setLayers((prev) => [...prev, { range, data, key: newKey, opacity: 0 }]);

    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setLayers((prev) =>
          prev.map((l) =>
            l.key === newKey ? { ...l, opacity: 1 } : { ...l, opacity: 0 }
          )
        );
      });
    });

    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setLayers((prev) => {
        const last = prev[prev.length - 1];
        return last ? [{ ...last, opacity: 1 }] : prev;
      });
    }, FADE_MS + 60);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, data]);

  const isTransitioning = layers.length > 1;

  return (
    <div
      className="relative"
      style={{
        height,
        pointerEvents: isTransitioning ? 'none' : 'auto',
      }}
    >
      {layers.map((layer) => (
        <div
          key={layer.key}
          className="absolute inset-0"
          style={{
            opacity: layer.opacity,
            transition: `opacity ${FADE_MS}ms ease-out`,
          }}
        >
          <PLChart data={layer.data} range={layer.range} height={height} />
        </div>
      ))}
    </div>
  );
}
