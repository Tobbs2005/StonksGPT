import { Router, Request, Response } from 'express';
import { fetchMarketData } from '../services/market-data';
import { formatChartData } from '../services/chart-formatter';

const router = Router();

/**
 * Chart data endpoint
 * POST /api/chart/data
 * Body: { symbol: string, timeframe?: string, chartType?: 'line' | 'candlestick' }
 */
router.post('/data', async (req: Request, res: Response) => {
  try {
    const { symbol, timeframe = '1mo', chartType } = req.body;

    if (!symbol || typeof symbol !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'symbol is required and must be a string',
      });
    }

    // Validate timeframe
    const validTimeframes = ['1d', '5d', '1mo', '6mo', '1y', '5y'];
    const validTimeframe = validTimeframes.includes(timeframe) ? timeframe : '1mo';

    console.log(`[chart] Fetching chart data for ${symbol}, timeframe: ${validTimeframe}`);

    // Fetch market data
    const dataPoints = await fetchMarketData({
      symbol: symbol.toUpperCase(),
      timeframe: validTimeframe as any,
    });

    if (!dataPoints || dataPoints.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No market data found for symbol ${symbol}`,
      });
    }

    // Format data using Gemini
    const chartData = await formatChartData(dataPoints, symbol.toUpperCase(), validTimeframe);

    // Prefer candlestick when OHLC data is available
    const hasOhlc = dataPoints.some((point) => (
      point.open !== undefined &&
      point.high !== undefined &&
      point.low !== undefined &&
      point.close !== undefined
    ));
    if (hasOhlc) {
      chartData.chartType = 'candlestick';
    }

    // Override chart type if specified
    if (chartType && (chartType === 'line' || chartType === 'candlestick')) {
      chartData.chartType = chartType;
    }

    return res.json({
      success: true,
      data: chartData,
    });
  } catch (error: any) {
    console.error('[chart] Error fetching chart data:', error);
    
    let errorMessage = error.message || 'Failed to fetch chart data';
    let suggestions: string[] = [];

    if (error.message?.includes('not found') || error.message?.includes('Symbol')) {
      errorMessage = `Symbol "${req.body.symbol || 'unknown'}" was not found.`;
      suggestions = [
        'Verify the symbol is correct (e.g., AAPL, MSFT, GOOGL)',
        'Check for typos in the symbol name',
        'Ensure the symbol is a valid stock ticker',
      ];
    } else if (error.message?.includes('GEMINI_API_KEY')) {
      errorMessage = 'Chart formatting service is not configured.';
      suggestions = [
        'Set GEMINI_API_KEY environment variable',
        'Chart data will be formatted without AI assistance',
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
