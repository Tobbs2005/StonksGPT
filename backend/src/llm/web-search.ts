/**
 * Web Search Service
 * 
 * Provides web search functionality to resolve company names, groups, and symbols
 * Uses Google Gemini API for web search
 */

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
 * Uses gemini-3-flash-preview
 */
function getGeminiModel(genAI: any): any {
  return genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
}

/**
 * Search the web for information about companies, symbols, or groups
 * Uses Google Gemini API for web search
 */
export async function searchWeb(query: string): Promise<string> {
  console.log(`[web-search] Starting search for: "${query}"`);
  
  // Retry logic for rate limiting
  let lastError: any = null;
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
        console.log(`[web-search] Rate limited, retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      console.log('[web-search] Getting Gemini client...');
      const genAI = getGeminiClient();
      console.log('[web-search] Getting Gemini model...');
      const model = getGeminiModel(genAI);
      console.log('[web-search] Model obtained, generating content...');
      
      const prompt = `Search the web and provide information about: ${query}

Please provide:
1. A concise summary of what this is
2. If it's a company, provide the company name and any relevant stock ticker symbols
3. Key facts and details
4. If searching for stock symbols, list potential ticker symbols clearly

Be specific and accurate. If you find ticker symbols, format them clearly (e.g., "Ticker: AAPL" or "NYSE: AAPL").`;

      console.log('[web-search] Calling model.generateContent...');
      const result = await model.generateContent(prompt);
      console.log('[web-search] Got result, extracting response...');
      const response = await result.response;
      const text = response.text();
      console.log(`[web-search] Success! Got ${text.length} characters`);
      
      return text.trim() || `No specific information found for "${query}". Try searching for the company name or ticker symbol directly.`;
    } catch (error: any) {
      lastError = error;
      const errorMsg = error.message || '';
      
      console.error('[web-search] Gemini web search error:', error);
      console.error('[web-search] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        code: error.code,
      });
      
      // Check if it's a rate limit error
      if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('rate limit')) {
        if (attempt < maxRetries - 1) {
          continue; // Retry
        }
        // Final attempt failed, return helpful error
        return `Rate limit error: The search service is temporarily unavailable due to too many requests. Please wait a moment and try again, or use get_asset() with specific symbols instead.`;
      }
      
      // For other errors, handle immediately
      // If API key is missing, provide helpful error message
      if (errorMsg.includes('GEMINI_API_KEY')) {
        return `Search error: ${errorMsg}. Please set GEMINI_API_KEY in your .env file.`;
      }
      
      // If model not found, provide helpful error
      if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        return `Search error: Gemini model not found. Please check your API key has access to Gemini models. Error: ${errorMsg}`;
      }
      
      // For other errors, throw to exit retry loop
      break;
    }
  }
  
  // If we get here, all retries failed or it was a non-retryable error
  const errorMsg = lastError?.message || 'Unknown error';
  return `Search error: ${errorMsg}. Please try using the get_asset tool with a specific symbol instead.`;
}

/**
 * Search for stock ticker symbols given a company name or group name
 * Returns a list of potential symbols using Gemini API
 */
export async function searchStockSymbols(query: string): Promise<string> {
  try {
    // Check if query is about cryptocurrencies
    const cryptoKeywords = ['crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'cryptocurrency', 'cryptocurrencies', 'coin', 'token'];
    const lowerQuery = query.toLowerCase();
    if (cryptoKeywords.some(keyword => lowerQuery.includes(keyword))) {
      return `This query is about cryptocurrencies, not stocks. For crypto trading, use place_crypto_order with symbols like "BTC/USD" or "ETH/USD". For crypto market data, use get_crypto_snapshot or get_crypto_latest_quote with symbols like "BTC/USD".`;
    }

    const genAI = getGeminiClient();
    const model = getGeminiModel(genAI);
    
    const prompt = `Find the stock ticker symbol(s) for: ${query}

Requirements:
1. Search for the company or companies matching this query
2. List all relevant stock ticker symbols (1-5 uppercase letters)
3. Include the exchange if known (NYSE, NASDAQ, etc.)
4. Format clearly: "SYMBOL" or "Exchange: SYMBOL" or "Company Name (SYMBOL)"
5. If multiple companies match, list all of them
6. If it's a group (like "MAG7" or "gold mining companies"), list all relevant ticker symbols

Be specific and accurate. Only include valid ticker symbols.`;

    // Retry logic for rate limiting
    let lastError: any = null;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[web-search] Rate limited, retrying after ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        // Extract ticker symbols from the response
        const tickerPatterns = [
          /\b(NYSE|NASDAQ|NYSEARCA):\s*([A-Z]{1,5})\b/g,
          /\$([A-Z]{1,5})\b/g,
          /\bticker[:\s]+([A-Z]{1,5})\b/gi,
          /\bsymbol[:\s]+([A-Z]{1,5})\b/gi,
          /\b([A-Z]{2,5})\s+\(([A-Z]{1,5})\)/g,
          /\b([A-Z]{1,5})\s+stock/gi,
          /\b([A-Z]{1,5})\b/g, // General uppercase pattern
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
        
        // Filter out common words
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
        const errorMsg = error.message || '';
        
        // Check if it's a rate limit error
        if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('rate limit')) {
          if (attempt < maxRetries - 1) {
            continue; // Retry
          }
          // Final attempt failed, return helpful error
          return `Rate limit error: The search service is temporarily unavailable due to too many requests. Please wait a moment and try again, or use get_asset() with specific symbols instead.`;
        }
        
        // For other errors, throw immediately
        throw error;
      }
    }
    
    // Should not reach here, but just in case
    throw lastError;
  } catch (error: any) {
    const errorMsg = error.message || '';
    
    // Provide helpful error messages
    if (errorMsg.includes('429') || errorMsg.includes('Too Many Requests')) {
      return `Rate limit error: The search service is temporarily unavailable. Please wait a moment and try again, or use get_asset() with specific symbols instead.`;
    }
    
    if (errorMsg.includes('GEMINI_API_KEY')) {
      return `Search error: ${errorMsg}. Please set GEMINI_API_KEY in your .env file.`;
    }
    
    return `Error searching for symbols: ${errorMsg}. Please try using get_asset() with specific symbols instead.`;
  }
}

/**
 * Resolve a company name or group to stock symbols
 * Handles special cases like "MAG7" (Magnificent 7), "FAANG", etc.
 */
export async function resolveSymbols(query: string): Promise<string> {
  const lowerQuery = query.toLowerCase().trim();
  
  // Handle known groups
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
  
  // Check if it's already a ticker symbol (all caps, 1-5 letters)
  if (/^[A-Z]{1,5}$/.test(query.toUpperCase())) {
    return `"${query}" appears to be a ticker symbol. Use get_asset("${query.toUpperCase()}") to verify.`;
  }
  
  // Search the web for the symbol
  return await searchStockSymbols(query);
}
