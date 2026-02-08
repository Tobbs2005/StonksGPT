import { useMemo } from 'react';

interface PLSparklineProps {
  /** Array of equity values over time */
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

export function PLSparkline({ data, width = 280, height = 80, className }: PLSparklineProps) {
  const path = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const xStep = width / (data.length - 1);

    const points = data.map((value, index) => {
      const x = index * xStep;
      const y = height - ((value - min) / range) * (height - 8) - 4;
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  }, [data, width, height]);

  const areaPath = useMemo(() => {
    if (data.length < 2) return '';
    return `${path} L${width},${height} L0,${height} Z`;
  }, [path, width, height, data.length]);

  const isPositive = data.length >= 2 && data[data.length - 1] >= data[0];
  const strokeColor = isPositive ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))';
  const fillColor = isPositive ? 'hsl(var(--chart-1) / 0.1)' : 'hsl(var(--destructive) / 0.1)';

  if (data.length < 2) {
    return (
      <div className={className} style={{ width, height }}>
        <p className="text-xs text-muted-foreground flex items-center justify-center h-full">
          No data
        </p>
      </div>
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      <path d={areaPath} fill={fillColor} />
      <path d={path} fill="none" stroke={strokeColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
