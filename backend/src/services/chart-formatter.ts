/**
 * Chart Formatter Service
 * 
 * Uses Gemini API to format raw market data into structured JSON for charting
 */

import { MarketDataPoint } from './market-data';

let geminiClient: any = null;

/**
 * Initialize Gemini client
 */
function getGeminiClient() {
  if (!geminiClient) {
    let GoogleGenerativeAI;
    try {
      GoogleGenerativeAI = require('@google/generative-ai').GoogleGenerativeAI;
    } catch (error) {
      throw new Error('@google/generative-ai package is not installed. Please run: npm install @google/generative-ai');
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set. Please set it in your .env file.');
    }
    
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

/**
 * Get Gemini model
 */
function getGeminiModel(genAI: any): any {
  return genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
}

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
 * Format market data into structured JSON for charting using Gemini
 */
export async function formatChartData(
  dataPoints: MarketDataPoint[],
  symbol: string,
  timeframe: string
): Promise<ChartData> {
  try {
    // Prepare data for Gemini
    const dataSample = dataPoints.slice(0, 10).map(point => ({
      date: point.date.toISOString(),
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
      volume: point.volume,
    }));

    const prompt = `Parse the following market data into structured JSON format for charting.

Data points (showing first 10 of ${dataPoints.length}):
${JSON.stringify(dataSample, null, 2)}

Requirements:
1. Extract all dates, OHLC prices, and volumes from the data
2. Format dates as ISO strings (YYYY-MM-DDTHH:mm:ss.sssZ)
3. Determine chart type:
   - Use "candlestick" if data has open, high, low, close values
   - Use "line" if only close prices are available
4. Return structured format:
{
  "chartType": "line" | "candlestick",
  "data": [
    {
      "date": "ISO string",
      "open": number (optional, only if candlestick),
      "high": number (optional, only if candlestick),
      "low": number (optional, only if candlestick),
      "close": number,
      "volume": number
    }
  ],
  "metadata": {
    "symbol": "${symbol}",
    "timeframe": "${timeframe}",
    "lastUpdate": "ISO string"
  }
}

Process ALL ${dataPoints.length} data points, not just the sample. Return ONLY valid JSON, no markdown or explanations.`;

    console.log(`[chart-formatter] Formatting ${dataPoints.length} data points for ${symbol} using Gemini`);
    
    const genAI = getGeminiClient();
    const model = getGeminiModel(genAI);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const chartData: ChartData = JSON.parse(jsonText);

    // Validate and ensure all data points are included
    if (chartData.data.length < dataPoints.length) {
      // If Gemini didn't process all points, manually format them
      chartData.data = dataPoints.map(point => ({
        date: point.date.toISOString(),
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: point.volume,
      }));

      // Determine chart type based on data
      const hasOHLC = dataPoints.some(p => p.open && p.high && p.low);
      chartData.chartType = hasOHLC ? 'candlestick' : 'line';
    }

    // Ensure metadata is set
    chartData.metadata = {
      symbol,
      timeframe,
      lastUpdate: new Date().toISOString(),
    };

    console.log(`[chart-formatter] Formatted chart data: ${chartData.chartType} chart with ${chartData.data.length} points`);
    return chartData;
  } catch (error: any) {
    console.error('[chart-formatter] Error formatting chart data:', error);
    
    // Fallback: format data manually without Gemini
    console.log('[chart-formatter] Falling back to manual formatting');
    return formatChartDataManually(dataPoints, symbol, timeframe);
  }
}

/**
 * Fallback: Format chart data manually without Gemini
 */
function formatChartDataManually(
  dataPoints: MarketDataPoint[],
  symbol: string,
  timeframe: string
): ChartData {
  const hasOHLC = dataPoints.some(p => p.open && p.high && p.low && p.close);
  
  const chartData: ChartData = {
    chartType: hasOHLC ? 'candlestick' : 'line',
    data: dataPoints.map(point => ({
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

  return chartData;
}
