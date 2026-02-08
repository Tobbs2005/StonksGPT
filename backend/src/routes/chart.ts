import { Router, Request, Response } from 'express';
import { fetchMarketData } from '../services/market-data';
import { formatChartData, ChartData } from '../services/chart-formatter';

const router = Router();

// ── Server-side in-memory cache ──────────────────────────────────────

interface CacheEntry {
  data: ChartData;
  createdAt: number;
}

const chartCache = new Map<string, CacheEntry>();

/** TTL (ms) varies by timeframe — shorter ranges change faster. */
function getCacheTTL(timeframe: string): number {
  const ttls: Record<string, number> = {
    '1d': 30_000,    // 30 s  (intraday data updates frequently)
    '5d': 60_000,    // 1 min
    '1mo': 300_000,  // 5 min
    '6mo': 300_000,  // 5 min
    '1y': 900_000,   // 15 min
    '5y': 900_000,   // 15 min
  };
  return ttls[timeframe] || 300_000;
}

function cacheKey(symbol: string, timeframe: string): string {
  return `${symbol}:${timeframe}`;
}

/** Evict entries older than their TTL (lightweight sweep). */
function evictStaleEntries(): void {
  const now = Date.now();
  for (const [key, entry] of chartCache.entries()) {
    const tf = key.split(':')[1] || '1mo';
    if (now - entry.createdAt > getCacheTTL(tf) * 2) {
      chartCache.delete(key);
    }
  }
}

// Sweep every 60 s to avoid unbounded growth
setInterval(evictStaleEntries, 60_000);

// ── Route ────────────────────────────────────────────────────────────

/**
 * Chart data endpoint
 * POST /api/chart/data
 * Body: { symbol: string, timeframe?: string, chartType?: 'line' | 'candlestick' }
 */
router.post('/data', async (req: Request, res: Response) => {
  const t0 = Date.now();

  try {
    const { symbol, timeframe = '1mo', chartType } = req.body;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'symbol is required and must be a string',
      });
    }

    const validTimeframes = ['1d', '5d', '1mo', '6mo', '1y', '5y'];
    const validTimeframe = validTimeframes.includes(timeframe) ? timeframe : '1mo';
    const upperSymbol = symbol.toUpperCase();
    const key = cacheKey(upperSymbol, validTimeframe);

    // ── Check cache ──
    const cached = chartCache.get(key);
    if (cached && Date.now() - cached.createdAt < getCacheTTL(validTimeframe)) {
      const chartData = { ...cached.data };

      // Override chart type if requested
      if (chartType && (chartType === 'line' || chartType === 'candlestick')) {
        chartData.chartType = chartType;
      }

      const elapsed = Date.now() - t0;
      console.log(`[chart-timing] ${upperSymbol} ${validTimeframe} — CACHE HIT — ${elapsed}ms`);
      return res.json({ success: true, data: chartData });
    }

    // ── Fetch market data ──
    const tFetch = Date.now();
    console.log(`[chart] Fetching chart data for ${upperSymbol}, timeframe: ${validTimeframe}`);

    const dataPoints = await fetchMarketData({
      symbol: upperSymbol,
      timeframe: validTimeframe as any,
    });

    const fetchMs = Date.now() - tFetch;

    if (!dataPoints || dataPoints.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No market data found for symbol ${symbol}`,
      });
    }

    // ── Trim intraday data to the correct window ──
    // We fetch extra calendar days to cover weekends/holidays, but the
    // chart should only show data for the labelled period.
    let trimmedPoints = dataPoints;
    if (validTimeframe === '1d' && dataPoints.length > 0) {
      // Show only the most recent trading day
      const lastDate = dataPoints[dataPoints.length - 1].date;
      const lastDay = lastDate.toISOString().slice(0, 10);
      trimmedPoints = dataPoints.filter(
        (p) => p.date.toISOString().slice(0, 10) === lastDay,
      );
    } else if (validTimeframe === '5d') {
      // Show only the last 5 trading days' worth of data
      const tradingDays = new Set(
        dataPoints.map((p) => p.date.toISOString().slice(0, 10)),
      );
      const sortedDays = Array.from(tradingDays).sort().slice(-5);
      const keep = new Set(sortedDays);
      trimmedPoints = dataPoints.filter(
        (p) => keep.has(p.date.toISOString().slice(0, 10)),
      );
    }

    // ── Format data (deterministic, no LLM) ──
    const tFormat = Date.now();
    const chartData = formatChartData(trimmedPoints, upperSymbol, validTimeframe);
    const formatMs = Date.now() - tFormat;

    // Prefer candlestick when OHLC data is available
    const hasOhlc = trimmedPoints.some(
      (point) =>
        point.open !== undefined &&
        point.high !== undefined &&
        point.low !== undefined &&
        point.close !== undefined,
    );
    if (hasOhlc) {
      chartData.chartType = 'candlestick';
    }

    // Override chart type if specified
    if (chartType && (chartType === 'line' || chartType === 'candlestick')) {
      chartData.chartType = chartType;
    }

    // ── Store in cache ──
    chartCache.set(key, { data: chartData, createdAt: Date.now() });

    const totalMs = Date.now() - t0;
    console.log(
      `[chart-timing] ${upperSymbol} ${validTimeframe} — fetch: ${fetchMs}ms, format: ${formatMs}ms, total: ${totalMs}ms (${trimmedPoints.length} pts, fetched ${dataPoints.length})`,
    );

    return res.json({ success: true, data: chartData });
  } catch (error: any) {
    const totalMs = Date.now() - t0;
    console.error(`[chart] Error fetching chart data (${totalMs}ms):`, error);

    let errorMessage = error.message || 'Failed to fetch chart data';
    let suggestions: string[] = [];

    if (error.message?.includes('not found') || error.message?.includes('Symbol')) {
      errorMessage = `Symbol "${req.body.symbol || 'unknown'}" was not found.`;
      suggestions = [
        'Verify the symbol is correct (e.g., AAPL, MSFT, GOOGL)',
        'Check for typos in the symbol name',
        'Ensure the symbol is a valid stock ticker',
      ];
    }

    return res.status(500).json({
      success: false,
      error: errorMessage,
      suggestions,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;
