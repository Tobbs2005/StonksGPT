/**
 * Web Search Service
 * 
 * Provides web search functionality to resolve company names, groups, and symbols.
 * Uses Dedalus Labs chat completions (LLM knowledge) for lookups.
 * 
 * Note: Previously used Brave Search MCP but the free tier rate limits (1 req/sec)
 * caused persistent 429 errors. The LLM's built-in knowledge is sufficient for
 * stock symbol resolution and company lookups.
 */

import { Dedalus } from 'dedalus-labs';

let dedalusClient: Dedalus | null = null;

function getClient(): Dedalus {
  if (!dedalusClient) {
    dedalusClient = new Dedalus();
  }
  return dedalusClient;
}

const MODEL = 'openai/gpt-5-nano';

/**
 * Run a query through Dedalus chat completions (no MCP, no external search).
 */
async function runQuery(prompt: string): Promise<string> {
  const client = getClient();

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'You are a financial research assistant. Provide accurate, concise information about companies, stock ticker symbols, and markets. When listing ticker symbols, format them clearly (e.g., "NYSE: AAPL").',
      },
      { role: 'user', content: prompt },
    ],
  });

  const text = (response as any).choices?.[0]?.message?.content || '';
  return text.trim();
}

/**
 * Search for information about companies, symbols, or groups.
 */
export async function searchWeb(query: string): Promise<string> {
  console.log(`[web-search] Starting search for: "${query}"`);

  const maxRetries = 3;
  const baseDelay = 1000;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`[web-search] Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const prompt = `Provide information about: ${query}

Please provide:
1. A concise summary of what this is
2. If it's a company, provide the company name and any relevant stock ticker symbols
3. Key facts and details
4. If searching for stock symbols, list potential ticker symbols clearly

Be specific and accurate. If you find ticker symbols, format them clearly (e.g., "Ticker: AAPL" or "NYSE: AAPL").`;

      const text = await runQuery(prompt);
      console.log(`[web-search] Success! Got ${text.length} characters`);

      return text || `No specific information found for "${query}". Try searching for the company name or ticker symbol directly.`;
    } catch (error: any) {
      lastError = error;
      console.error('[web-search] Search error:', error.message || error);

      const msg = error.message || '';
      if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate limit') || msg.includes('RateLimit')) {
        if (attempt < maxRetries - 1) continue;
        return `Rate limit error: The search service is temporarily unavailable due to too many requests. Please wait a moment and try again, or use get_asset() with specific symbols instead.`;
      }

      break;
    }
  }

  const errorMsg = lastError?.message || 'Unknown error';
  return `Search error: ${errorMsg}. Please try using the get_asset tool with a specific symbol instead.`;
}

/**
 * Search for stock ticker symbols given a company name or group name.
 */
export async function searchStockSymbols(query: string): Promise<string> {
  try {
    const cryptoKeywords = ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'cryptocurrency', 'cryptocurrencies', 'coin', 'token'];
    const lowerQuery = query.toLowerCase();
    if (cryptoKeywords.some(keyword => lowerQuery.includes(keyword))) {
      return `This query is about cryptocurrencies, not stocks. For crypto trading, use place_crypto_order with symbols like "BTC/USD" or "ETH/USD". For crypto market data, use get_crypto_snapshot or get_crypto_latest_quote with symbols like "BTC/USD".`;
    }

    const prompt = `Find the stock ticker symbol(s) for: ${query}

Requirements:
1. List all relevant stock ticker symbols (1-5 uppercase letters)
2. Include the exchange if known (NYSE, NASDAQ, etc.)
3. Format: "Company Name (EXCHANGE: SYMBOL)"
4. If multiple companies match, list all of them
5. If it's a group (like "MAG7" or "gold mining companies"), list all relevant symbols

Be specific and accurate. Only include valid ticker symbols.`;

    let lastError: any = null;
    const maxRetries = 3;
    const baseDelay = 1000;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = baseDelay * Math.pow(2, attempt - 1);
          console.log(`[web-search] Retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const text = await runQuery(prompt);

        const tickerPatterns = [
          /\b(NYSE|NASDAQ|NYSEARCA):\s*([A-Z]{1,5})\b/g,
          /\$([A-Z]{1,5})\b/g,
          /\bticker[:\s]+([A-Z]{1,5})\b/gi,
          /\bsymbol[:\s]+([A-Z]{1,5})\b/gi,
          /\b([A-Z]{2,5})\s+\(([A-Z]{1,5})\)/g,
          /\b([A-Z]{1,5})\s+stock/gi,
          /\b([A-Z]{1,5})\b/g,
        ];

        const foundSymbols = new Set<string>();

        for (const pattern of tickerPatterns) {
          const matches = text.matchAll(pattern);
          for (const match of matches) {
            const symbol = (match[2] || match[1])?.toUpperCase();
            if (symbol && symbol.length >= 1 && symbol.length <= 5) {
              foundSymbols.add(symbol);
            }
          }
        }

        const commonWords = new Set(['THE', 'AND', 'FOR', 'ARE', 'WITH', 'FROM', 'THAT', 'THIS', 'NYSE', 'NASDAQ', 'NYSEARCA', 'STOCK', 'TICKER', 'SYMBOL', 'CORP', 'INC', 'LTD', 'LLC', 'GOLD', 'MINING', 'COMPANY', 'LIMITED', 'EXCHANGE', 'TRADING']);
        const likelyTickers = Array.from(foundSymbols).filter(t =>
          t.length >= 1 &&
          t.length <= 5 &&
          !commonWords.has(t)
        );

        if (likelyTickers.length > 0) {
          const uniqueTickers = [...new Set(likelyTickers)].slice(0, 10);
          return `Found potential ticker symbols for "${query}": ${uniqueTickers.join(', ')}\n\nIMPORTANT: Verify each symbol using get_asset(symbol) before placing orders.\n\nSearch results:\n${text}`;
        }

        return `Search completed for "${query}". No clear ticker symbols found in results.\n\nSearch results:\n${text}`;
      } catch (error: any) {
        lastError = error;
        const msg = error.message || '';

        if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate limit') || msg.includes('RateLimit')) {
          if (attempt < maxRetries - 1) continue;
          return `Rate limit error: The search service is temporarily unavailable. Please wait and try again, or use get_asset() with specific symbols instead.`;
        }

        throw error;
      }
    }

    throw lastError;
  } catch (error: any) {
    const errorMsg = error.message || '';

    if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
      return `Rate limit error: The search service is temporarily unavailable. Please wait and try again, or use get_asset() with specific symbols instead.`;
    }

    return `Error searching for symbols: ${errorMsg}. Please try using get_asset() with specific symbols instead.`;
  }
}

/**
 * Resolve a company name or group to stock symbols.
 */
export async function resolveSymbols(query: string): Promise<string> {
  const lowerQuery = query.toLowerCase().trim();

  const knownGroups: Record<string, string[]> = {
    'mag7': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'],
    'magnificent 7': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'],
    'magnificent seven': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'],
    'faang': ['META', 'AAPL', 'AMZN', 'NFLX', 'GOOGL'],
    'faangm': ['META', 'AAPL', 'AMZN', 'NFLX', 'GOOGL', 'MSFT'],
    'faangmt': ['META', 'AAPL', 'AMZN', 'NFLX', 'GOOGL', 'MSFT', 'TSLA'],
  };

  if (knownGroups[lowerQuery]) {
    return `"${query}" refers to: ${knownGroups[lowerQuery].join(', ')}`;
  }

  if (/^[A-Z]{1,5}$/.test(query.toUpperCase())) {
    return `"${query}" appears to be a ticker symbol. Use get_asset("${query.toUpperCase()}") to verify.`;
  }

  return await searchStockSymbols(query);
}
