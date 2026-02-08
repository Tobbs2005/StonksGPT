/**
 * Market Data Service
 *
 * Fetches stock market data using Alpaca MCP tools.
 */

import { getMCPClient } from '../mcp/client';

export interface MarketDataOptions {
  symbol: string;
  timeframe: '1d' | '5d' | '1mo' | '6mo' | '1y' | '5y';
  interval?: '1m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1wk' | '1mo';
}

export interface MarketDataPoint {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Convert timeframe string to yahoo-finance2 interval and period
 */
function parseTimeframe(timeframe: string): { alpacaTimeframe: string; days: number; hours: number; minutes: number } {
  // NOTE: Intraday lookback windows are wider than the label implies so we
  // always capture the most recent trading session even on weekends/holidays.
  // "1d" uses 4 calendar days (covers Sat/Sun/Mon-holiday edge case).
  // "5d" uses 9 calendar days (covers a full week + weekend padding).
  const mapping: Record<string, { alpacaTimeframe: string; days: number; hours: number; minutes: number }> = {
    '1d': { alpacaTimeframe: '5Min', days: 4, hours: 0, minutes: 0 },
    '5d': { alpacaTimeframe: '15Min', days: 9, hours: 0, minutes: 0 },
    '1mo': { alpacaTimeframe: '1Day', days: 30, hours: 0, minutes: 0 },
    '6mo': { alpacaTimeframe: '1Day', days: 180, hours: 0, minutes: 0 },
    '1y': { alpacaTimeframe: '1Day', days: 365, hours: 0, minutes: 0 },
    '5y': { alpacaTimeframe: '1Week', days: 1825, hours: 0, minutes: 0 },
  };

  return mapping[timeframe] || { alpacaTimeframe: '1Day', days: 30, hours: 0, minutes: 0 };
}

function parseBarsOutput(output: string): MarketDataPoint[] {
  const lines = output.split('\n').map((line) => line.trim()).filter(Boolean);
  const dataPoints: MarketDataPoint[] = [];

  const barRegex = /^Time:\s*(.*?),\s*Open:\s*\$(.*?),\s*High:\s*\$(.*?),\s*Low:\s*\$(.*?),\s*Close:\s*\$(.*?),\s*Volume:\s*([0-9,\.]+)$/;

  for (const line of lines) {
    const match = line.match(barRegex);
    if (!match) {
      continue;
    }

    const [, timeStrRaw, openRaw, highRaw, lowRaw, closeRaw, volumeRaw] = match;
    let timeStr = timeStrRaw.trim();

    if (timeStr.endsWith('UTC')) {
      timeStr = timeStr.replace(' UTC', '').replace(' ', 'T') + 'Z';
    } else if (!timeStr.includes('T')) {
      timeStr = `${timeStr}T00:00:00Z`;
    }

    const date = new Date(timeStr);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const toNumber = (value: string) => parseFloat(value.replace(/,/g, ''));

    dataPoints.push({
      date,
      open: toNumber(openRaw),
      high: toNumber(highRaw),
      low: toNumber(lowRaw),
      close: toNumber(closeRaw),
      volume: toNumber(volumeRaw),
    });
  }

  return dataPoints;
}

/**
 * Fetch historical market data for a symbol
 */
export async function fetchMarketData(options: MarketDataOptions): Promise<MarketDataPoint[]> {
  try {
    const { alpacaTimeframe, days, hours, minutes } = parseTimeframe(options.timeframe);

    console.log(`[market-data] Fetching data for ${options.symbol}, timeframe: ${options.timeframe}, alpaca: ${alpacaTimeframe}`);

    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const result = await mcpClient.callTool({
      name: 'get_stock_bars',
      arguments: {
        symbol: options.symbol,
        timeframe: alpacaTimeframe,
        days,
        hours,
        minutes,
      },
    });

    if (typeof result !== 'string') {
      throw new Error('Unexpected response from Alpaca MCP tool');
    }

    if (result.toLowerCase().includes('error')) {
      throw new Error(result);
    }

    const dataPoints = parseBarsOutput(result);
    if (!dataPoints.length) {
      throw new Error(`No historical data found for ${options.symbol}`);
    }

    console.log(`[market-data] Fetched ${dataPoints.length} data points for ${options.symbol}`);
    return dataPoints;
  } catch (error: any) {
    console.error('[market-data] Error fetching market data:', error);
    throw new Error(`Failed to fetch market data for ${options.symbol}: ${error.message}`);
  }
}

/**
 * Get start date for a timeframe
 */
function getPeriodStartDate(timeframe: string): Date {
  const now = new Date();
  const mapping: Record<string, number> = {
    '1d': 1, // 1 day ago
    '5d': 5,
    '1mo': 30,
    '6mo': 180,
    '1y': 365,
    '5y': 1825,
  };

  const daysAgo = mapping[timeframe] || 30;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysAgo);
  return startDate;
}

/**
 * Get current quote for a symbol
 */
export async function getCurrentQuote(symbol: string): Promise<any> {
  try {
    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const result = await mcpClient.callTool({
      name: 'get_stock_latest_bar',
      arguments: {
        symbol_or_symbols: symbol,
      },
    });

    if (typeof result !== 'string') {
      throw new Error('Unexpected response from Alpaca MCP tool');
    }

    if (result.toLowerCase().includes('error')) {
      throw new Error(result);
    }

    return result;
  } catch (error: any) {
    console.error(`[market-data] Error fetching quote for ${symbol}:`, error);
    throw new Error(`Failed to fetch quote for ${symbol}: ${error.message}`);
  }
}
