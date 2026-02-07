import { useMemo, useRef, useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  createChart,
  ColorType,
  IChartApi,
  ISeriesApi,
  CandlestickSeries,
  LineSeries,
} from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export interface ChartData {
  chartType: 'line' | 'candlestick';
  data: Array<{
    date: string;
    open?: number;
    high?: number;
    low?: number;
    close: number;
    volume: number;
  }>;
  metadata: {
    symbol: string;
    timeframe: string;
    lastUpdate: string;
  };
}

interface StockChartProps {
  chartData: ChartData;
  onTimeframeChange?: (timeframe: string) => void;
  isLoading?: boolean;
}

const TIMEFRAMES = ['1d', '5d', '1mo', '6mo', '1y', '5y'] as const;

export function StockChart({ chartData, onTimeframeChange, isLoading }: StockChartProps) {
  const [chartType, setChartType] = useState<'line' | 'candlestick'>(chartData.chartType);
  const [timeframe, setTimeframe] = useState<string>(chartData.metadata.timeframe);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const lineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  useEffect(() => {
    setTimeframe(chartData.metadata.timeframe);
  }, [chartData.metadata.timeframe]);

  const seriesData = useMemo(() => {
    const toTimestamp = (value: string) => Math.floor(new Date(value).getTime() / 1000);
    const candlestick = chartData.data
      .filter((point) => (
        point.open !== undefined &&
        point.high !== undefined &&
        point.low !== undefined &&
        point.close !== undefined
      ))
      .map((point) => ({
        time: toTimestamp(point.date),
        open: point.open as number,
        high: point.high as number,
        low: point.low as number,
        close: point.close,
      }));
    const line = chartData.data.map((point) => ({
      time: toTimestamp(point.date),
      value: point.close,
    }));
    return { candlestick, line };
  }, [chartData.data]);

  const getThemeOptions = () => {
    if (typeof window === 'undefined') {
      return {
        background: '#ffffff',
        foreground: '#0f172a',
        grid: 'rgba(148, 163, 184, 0.2)',
        border: 'rgba(148, 163, 184, 0.3)',
      };
    }

    const rootStyle = getComputedStyle(document.documentElement);
    const background = rootStyle.getPropertyValue('--background').trim() || '0 0% 100%';
    const foreground = rootStyle.getPropertyValue('--foreground').trim() || '222.2 84% 4.9%';
    const mutedForeground = rootStyle.getPropertyValue('--muted-foreground').trim() || '215.4 16.3% 46.9%';

    return {
      background: `hsl(${background})`,
      foreground: `hsl(${foreground})`,
      grid: `hsl(${mutedForeground} / 0.2)`,
      border: `hsl(${mutedForeground} / 0.3)`,
    };
  };

  useEffect(() => {
    if (!chartContainerRef.current) {
      return;
    }

    const container = chartContainerRef.current;
    const themeOptions = getThemeOptions();
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: themeOptions.background },
        textColor: themeOptions.foreground,
      },
      grid: {
        vertLines: { color: themeOptions.grid },
        horzLines: { color: themeOptions.grid },
      },
      timeScale: {
        borderColor: themeOptions.border,
      },
      rightPriceScale: {
        borderColor: themeOptions.border,
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#26a69a',
      lineWidth: 2,
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    lineSeriesRef.current = lineSeries;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries.length) {
        return;
      }
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
    });

    resizeObserver.observe(container);

    const updateTheme = () => {
      const nextTheme = getThemeOptions();
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: nextTheme.background },
          textColor: nextTheme.foreground,
        },
        grid: {
          vertLines: { color: nextTheme.grid },
          horzLines: { color: nextTheme.grid },
        },
        timeScale: { borderColor: nextTheme.border },
        rightPriceScale: { borderColor: nextTheme.border },
      });
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      lineSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candlestickSeriesRef.current || !lineSeriesRef.current) {
      return;
    }

    candlestickSeriesRef.current.setData(seriesData.candlestick);
    lineSeriesRef.current.setData(seriesData.line);

    const showCandlestick = chartType === 'candlestick' && seriesData.candlestick.length > 0;
    candlestickSeriesRef.current.applyOptions({ visible: showCandlestick });
    lineSeriesRef.current.applyOptions({ visible: !showCandlestick });
  }, [seriesData, chartType]);

  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [seriesData]);

  const handleTimeframeChange = (nextTimeframe: string) => {
    setTimeframe(nextTimeframe);
    onTimeframeChange?.(nextTimeframe);
  };

  return (
    <Card className="w-full my-4">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">
              {chartData.metadata.symbol} - {chartData.metadata.timeframe.toUpperCase()}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Last updated: {format(parseISO(chartData.metadata.lastUpdate), 'MMM dd, yyyy HH:mm')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={chartType}
              onChange={(event) => setChartType(event.target.value as 'line' | 'candlestick')}
            >
              <option value="candlestick">Candlestick</option>
              <option value="line">Line</option>
            </select>
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={timeframe}
              onChange={(event) => handleTimeframeChange(event.target.value)}
              disabled={isLoading}
            >
              {TIMEFRAMES.map((frame) => (
                <option key={frame} value={frame}>
                  {frame.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="w-full" style={{ height: '400px' }}>
          <div ref={chartContainerRef} className="h-full w-full" />
        </div>
        {isLoading && (
          <p className="mt-2 text-xs text-muted-foreground">Updating chart...</p>
        )}
      </CardContent>
    </Card>
  );
}
