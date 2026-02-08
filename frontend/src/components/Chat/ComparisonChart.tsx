import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StockChart, ChartData } from './StockChart';

const TIMEFRAMES = ['1d', '5d', '1mo', '6mo', '1y', '5y'] as const;

interface ComparisonChartProps {
  /** Array of chart data (one per ticker). */
  charts: ChartData[];
  /** Whether data is currently loading. */
  isLoading?: boolean;
  /** Called when the shared timeframe changes. Receives all symbols. */
  onTimeframeChange?: (symbols: string[], timeframe: string) => void;
}

/**
 * Side-by-side (desktop) / stacked (mobile) comparison of 2+ stock charts.
 *
 * - Shared timeframe + chart-type controls at the top
 * - Each ticker gets its own lightweight-charts instance via `StockChart compact`
 * - Independent error handling per panel (if one chart has no data, the other still renders)
 */
export function ComparisonChart({
  charts,
  isLoading,
  onTimeframeChange,
}: ComparisonChartProps) {
  const [timeframe, setTimeframe] = useState<string>(
    charts[0]?.metadata.timeframe || '1mo',
  );
  const [chartType, setChartType] = useState<'line' | 'candlestick'>(
    charts[0]?.chartType || 'candlestick',
  );

  const symbols = charts.map((c) => c.metadata.symbol);

  const handleTimeframeChange = (nextTimeframe: string) => {
    setTimeframe(nextTimeframe);
    onTimeframeChange?.(symbols, nextTimeframe);
  };

  return (
    <Card className="w-full my-4">
      {/* ── Shared header with controls ─────────────────────── */}
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">
              {symbols.join(' vs ')} — {timeframe.toUpperCase()}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Comparing {charts.length} tickers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={chartType}
              onChange={(e) =>
                setChartType(e.target.value as 'line' | 'candlestick')
              }
            >
              <option value="candlestick">Candlestick</option>
              <option value="line">Line</option>
            </select>
            <div className="flex items-center gap-0.5 rounded-lg border border-input bg-muted/40 p-0.5">
              {TIMEFRAMES.map((frame) => (
                <button
                  key={frame}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleTimeframeChange(frame)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-150',
                    timeframe === frame
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                    isLoading && 'opacity-50 cursor-not-allowed',
                  )}
                >
                  {frame.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      {/* ── Chart panels: side-by-side on lg, stacked on smaller ── */}
      <CardContent>
        <div
          className={cn(
            'grid gap-4',
            charts.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-1',
          )}
        >
          {charts.map((chart, idx) => (
            <div
              key={chart.metadata.symbol || idx}
              className="rounded-lg border border-border/40 p-3 bg-card/50"
            >
              <StockChart
                chartData={{
                  ...chart,
                  chartType, // use the shared chart type
                }}
                compact
                isLoading={isLoading}
                height={300}
              />
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 mt-3">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Updating all charts…
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
