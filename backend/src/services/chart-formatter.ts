/**
 * Chart Formatter Service
 *
 * Deterministic formatting of raw market data into structured JSON
 * suitable for lightweight-charts.
 *
 * NOTE: Gemini has been removed from this pipeline. LLM calls are
 * unnecessary for structured data transformation and were the primary
 * source of latency when switching chart timeframes. The manual
 * formatter produces identical output instantly.
 *
 * For LLM-powered text generation (insights, summaries), use the
 * unified provider in llm-provider.ts which includes automatic
 * Gemini → OpenAI fallback.
 */

import { MarketDataPoint } from './market-data';

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

/**
 * Format market data into structured chart JSON.
 *
 * This is now fully deterministic (no LLM) for maximum speed.
 */
export function formatChartData(
  dataPoints: MarketDataPoint[],
  symbol: string,
  timeframe: string,
): ChartData {
  const hasOHLC = dataPoints.some(
    (p) => p.open !== undefined && p.high !== undefined && p.low !== undefined && p.close !== undefined,
  );

  return {
    chartType: hasOHLC ? 'candlestick' : 'line',
    data: dataPoints.map((point) => ({
      date: point.date.toISOString(),
      ...(hasOHLC && {
        open: point.open,
        high: point.high,
        low: point.low,
      }),
      close: point.close,
      volume: point.volume,
    })),
    metadata: {
      symbol,
      timeframe,
      lastUpdate: new Date().toISOString(),
    },
  };
}
