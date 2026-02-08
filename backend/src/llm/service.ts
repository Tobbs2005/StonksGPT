import { getMCPClient } from '../mcp/client';
import { MCPToolCall } from '../types';
import { compressToolResult } from './result-compressor';
import { resolveSymbols, searchWeb } from './web-search';
import { fetchMarketAuxNews } from '../services/marketaux';

export interface LLMConfig {
  provider: 'dedalus';
  apiKey: string;
  model: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface LLMToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * LLM Service that handles natural language interpretation and tool calling
 */
export class LLMService {
  private config: LLMConfig | null = null;
  private configInitialized = false;
  private static cryptoBaseSymbols = new Set([
    'BTC',
    'ETH',
    'SOL',
    'DOGE',
    'LTC',
    'XRP',
    'ADA',
    'BNB',
    'AVAX',
  ]);

  constructor() {
    // Don't initialize immediately - wait until first use
    // This allows environment variables to be loaded first
  }

  private normalizeCryptoSymbolForTool(toolName: string, symbol: string): string {
    const raw = symbol.trim().toUpperCase();
    const isCryptoDataTool = toolName.startsWith('get_crypto');
    const isCryptoTradeTool = toolName === 'place_crypto_order';
    const isPositionTool = toolName === 'close_position' || toolName === 'get_open_position';

    if (!isCryptoDataTool && !isCryptoTradeTool && !isPositionTool) {
      return symbol;
    }

    let base = '';
    let quote = '';

    if (raw.includes('/')) {
      [base, quote] = raw.split('/').map((part) => part.trim());
    } else if (raw.includes('-')) {
      [base, quote] = raw.split('-').map((part) => part.trim());
    } else {
      const quoteMatch = raw.match(/(USD|USDT|USDC)$/);
      if (quoteMatch) {
        quote = quoteMatch[1];
        base = raw.slice(0, -quote.length);
      } else {
        base = raw;
        quote = 'USD';
      }
    }

    if (!base || !LLMService.cryptoBaseSymbols.has(base)) {
      return symbol;
    }

    if (!quote) {
      quote = 'USD';
    }

    if (isCryptoDataTool) {
      return `${base}/${quote}`;
    }

    return `${base}${quote}`;
  }

  private normalizeToolArgs(toolName: string, toolArgs: Record<string, any>): Record<string, any> {
    if (!toolArgs || typeof toolArgs !== 'object') {
      return toolArgs;
    }

    if (typeof toolArgs.symbol !== 'string') {
      return toolArgs;
    }

    const normalizedSymbol = this.normalizeCryptoSymbolForTool(toolName, toolArgs.symbol);
    if (normalizedSymbol === toolArgs.symbol) {
      return toolArgs;
    }

    return {
      ...toolArgs,
      symbol: normalizedSymbol,
    };
  }


  private ensureConfigInitialized(): void {
    if (!this.configInitialized) {
      // Ensure environment variables are loaded from .env file
      // This mimics what checkEnvironment does but doesn't require the MCP client
      this.loadEnvFile();
      this.initializeConfig();
      this.configInitialized = true;
    }
  }

  private loadEnvFile(): void {
    // Try to load .env file - prioritize root directory first
    const fs = require('fs');
    const path = require('path');
    
    const possiblePaths = [
      path.join(process.cwd(), '../.env'), // Root directory (if running from backend)
      path.join(process.cwd(), '../../.env'), // Root directory (if running from backend/dist)
      path.join(process.cwd(), '.env'), // Root directory (if running from root)
      path.join(__dirname, '../../../.env'), // Root directory (from compiled dist)
      path.join(__dirname, '../../../../.env'), // Root directory (from src)
      path.join(process.cwd(), '../alpaca-mcp-server/.env'), // Fallback to alpaca-mcp-server
      path.join(process.cwd(), 'alpaca-mcp-server/.env'), // Fallback to alpaca-mcp-server
      path.join(__dirname, '../../../alpaca-mcp-server/.env'), // Fallback to alpaca-mcp-server
      path.join(__dirname, '../../alpaca-mcp-server/.env'), // Fallback to alpaca-mcp-server
    ];

    for (const envPath of possiblePaths) {
      if (fs.existsSync(envPath)) {
        try {
          const envContent = fs.readFileSync(envPath, 'utf-8');
          const envVars = envContent.split('\n').filter((line: string) => line.trim() && !line.startsWith('#'));
          
          for (const line of envVars) {
            const [key, ...valueParts] = line.split('=');
            if (key && valueParts.length > 0) {
              const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
              const keyTrimmed = key.trim();
              
              // Only set if not already in process.env
              if (!process.env[keyTrimmed]) {
                if (keyTrimmed === 'LLM_PROVIDER' || 
                    keyTrimmed === 'DEDALUS_API_KEY' || 
                    keyTrimmed === 'LLM_MODEL') {
                  process.env[keyTrimmed] = value;
                }
              }
            }
          }
          console.log(`LLM Service: Loaded environment variables from ${envPath}`);
          break;
        } catch (err) {
          // Silently continue to next path
        }
      }
    }
  }

  private initializeConfig(): void {
    const provider: 'dedalus' = 'dedalus';
    const apiKey = process.env.DEDALUS_API_KEY || '';
    const model = process.env.LLM_MODEL || 'gpt-4o';

    if (!apiKey) {
      console.warn('No DEDALUS_API_KEY found. LLM features will be disabled.');
      return;
    }

    console.log(`LLM Service initialized with provider: ${provider}, model: ${model}`);
    this.config = { provider, apiKey, model };
  }

  /**
   * Check if LLM service is available and configured
   */
  isAvailable(): boolean {
    this.ensureConfigInitialized();
    
    if (!this.config) {
      console.log('LLM Service: No config available');
      return false;
    }

    // Dedalus Labs - check if API key is set (SDK check happens at runtime)
    const hasApiKey = !!this.config.apiKey && !!process.env.DEDALUS_API_KEY;
    if (!hasApiKey) {
      console.log('LLM Service: Dedalus API key not found');
      return false;
    }
    // Don't require SDK to be installed at initialization - let it fail gracefully at runtime
    return true;
  }

  /**
   * Process a user message and return a response, potentially calling MCP tools
   */
  async processMessage(userMessage: string, history?: ChatHistoryMessage[]): Promise<string> {
    this.ensureConfigInitialized();
    
    if (!this.config || !this.isAvailable()) {
      throw new Error('LLM service is not configured or available. Please set LLM_PROVIDER and corresponding API key.');
    }

    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const now = new Date();
    const currentTimeContext = `CURRENT DATE/TIME: ${now.toISOString()} (local: ${now.toString()})`;

    // Enhanced system prompt for Dedalus with mandatory tool usage rules
    const systemPrompt = `You are a trading assistant for Alpaca. Use the available MCP tools to execute user requests.
${currentTimeContext}

MANDATORY TOOL USAGE RULES:
1. When a user request involves company names, groups of companies, unclear tickers, or unknown assets, you MUST use web search tools or get_asset tool to resolve symbols.
2. Never refuse due to unknown symbols before calling tools.
3. Never assume a symbol is invalid without checking tools first.
4. If unsure about a symbol → USE WEB SEARCH TOOLS OR CALL get_asset() TOOL.
5. Common groups: "MAG7" or "Magnificent 7" = AAPL, MSFT, GOOGL, AMZN, NVDA, META, TSLA
6. Always call the appropriate tools when users make trading requests or ask questions about your account, positions, or market data.
7. After calling tools, provide clear and friendly responses based on the results.

CRITICAL WORKFLOW FOR TRADING REQUESTS WITH COMPANY NAMES:
When a user asks to buy/sell stocks by company name or industry (e.g., "buy $67 in each of the top 10 gold mining companies"):
1. Use web_search or search_stock_symbols to find company names and their ticker symbols
2. EXTRACT ticker symbols from search results (look for patterns like "NEM", "GOLD", "AEM", etc. or "$SYMBOL" format)
3. For EACH potential ticker symbol found:
   a. Call get_asset(symbol) to verify the symbol exists and is tradable
   b. If valid, call place_stock_order with the appropriate parameters
4. NEVER give up or refuse - keep searching and trying until you find valid symbols and execute the orders
5. If search results don't contain clear ticker symbols, try different search queries or extract company names and search for each individually

WEB SEARCH CAPABILITIES:
- Use web_search(query) to research company names, stock groups, or market information
- Use search_stock_symbols(query) to find ticker symbols for company names
- Extract ticker symbols from search results (they are typically 1-5 uppercase letters like "NEM", "GOLD", "AEM")
- Look for patterns in search results: "NYSE: NEM", "ticker: GOLD", "$SYMBOL", or just standalone uppercase letters

CHART CAPABILITIES:
- Use get_chart_data(symbol, timeframe?) when users ask to see charts, graphs, or visualizations of stock data
- Examples: "Show me GOOGL market data", "Display AAPL chart", "Graph MSFT stock"
- The chart data will be automatically displayed in the frontend
- Always include the chart data in your response when calling get_chart_data

NEWS CAPABILITIES:
- Use get_news when users ask for recent news or headlines about specific symbols
- Use get_portfolio_news when users ask for news on their portfolio
- Use get_watchlist_news when users ask for news on their watchlist
- If portfolio/watchlist news tools are unavailable, use get_all_positions/get_watchlists then call get_news with the symbols

TRADING EXECUTION:
- Use "notional" when user specifies dollar amount (e.g., "$67" → notional: 67)
- Use "quantity" when user specifies number of shares (e.g., "10 shares" → quantity: 10)
- For crypto orders, use place_crypto_order with symbols like "BTC/USD" and never use place_stock_order
- For crypto positions or trading, normalize symbols like BTC → BTCUSD (trading/positions) and use BTC/USD for crypto market data
- Always verify symbols with get_asset() before placing orders
- Execute ALL requested trades - do not stop after finding some symbols`;
    
    const sanitizedHistory = Array.isArray(history)
      ? history
          .filter((item) => item && typeof item.content === 'string' && (item.role === 'user' || item.role === 'assistant'))
          .slice(-3)
      : [];

    return await this.processWithDedalus(userMessage, systemPrompt, mcpClient, sanitizedHistory);
  }

  private async processWithDedalus(
    userMessage: string,
    systemPrompt: string,
    mcpClient: any,
    history: ChatHistoryMessage[] = []
  ): Promise<string> {
    // Try SDK first, then fall back to REST API
    let useSDK = false;
    try {
      const dedalusModule = require('dedalus-labs');
      const { AsyncDedalus, DedalusRunner } = dedalusModule;
      
      if (AsyncDedalus && DedalusRunner) {
        useSDK = true;
        const client = new AsyncDedalus({ apiKey: this.config!.apiKey });
        const runner = new DedalusRunner(client);

        // Configure MCP server connections
        // Dedalus will automatically discover tools from the MCP servers
        const mcpServers: any[] = [
          // Alpaca trading MCP server
          {
            name: 'alpaca-mcp-server',
            command: 'uvx',
            args: ['alpaca-mcp-server', 'serve'],
            env: {
              ALPACA_API_KEY: process.env.ALPACA_API_KEY,
              ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY,
              ALPACA_PAPER_TRADE: process.env.ALPACA_PAPER_TRADE || 'True',
            },
          },
        ];

        // Add web search MCP servers if available
        // These provide web search capabilities for symbol resolution and research
        const webSearchServers: string[] = [];
        
        // Check for web search MCP server environment variables
        if (process.env.ENABLE_WEB_SEARCH_MCP !== 'false') {
          // Add Exa semantic search (if configured)
          if (process.env.EXA_API_KEY) {
            webSearchServers.push('tsion/exa');
          }
          
          // Add Brave Search (if configured)
          if (process.env.BRAVE_API_KEY) {
            webSearchServers.push('windsor/brave-search-mcp');
          }
          
          // If no specific API keys, try adding Brave Search anyway (may work without key)
          if (webSearchServers.length === 0) {
            webSearchServers.push('windsor/brave-search-mcp');
          }
        }

        // Add web search servers to MCP servers list
        mcpServers.push(...webSearchServers);

        const historyText = history.length
          ? `RECENT CONTEXT:\n${history
              .map((item) => `${item.role === 'user' ? 'User' : 'Assistant'}: ${item.content}`)
              .join('\n')}\n\n`
          : '';
        const response = await runner.run({
          input: `${historyText}${userMessage}`,
          model: [this.config!.model],
          mcp_servers: mcpServers,
          // Don't pass tools - let Dedalus discover them from MCP servers automatically
        });

        return response.content || response.text || JSON.stringify(response);
      }
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('Cannot find module')) {
        console.log('Dedalus SDK not found, using REST API instead');
        useSDK = false;
      } else {
        console.error('Dedalus SDK error:', error.message);
        // If SDK fails, try REST API fallback
        useSDK = false;
      }
    }

    // Fall back to REST API (OpenAI-compatible endpoint) if SDK not available
    // Filter out options tools and limit to ~30 tools to stay within token limits
    if (!useSDK) {
      const toolSchemas = await mcpClient.getToolSchemas();
      
      // Filter out options tools
      const filteredTools = toolSchemas.filter((tool: ToolSchema) => {
        const name = tool.name.toLowerCase();
        return !name.includes('option');
      });
      
      // Limit to approximately 30 tools (prioritize stock trading tools)
      // Stock trading and market data tools are most important
      const stockTradingTools = filteredTools.filter((t: ToolSchema) => {
        const name = t.name.toLowerCase();
        return name.includes('place_stock_order') || 
               name.includes('get_orders') || 
               name.includes('cancel') ||
               name.includes('position') ||
               name.includes('account');
      });
      
      const stockMarketDataTools = filteredTools.filter((t: ToolSchema) => {
        const name = t.name.toLowerCase();
        return name.includes('stock') && 
               (name.includes('quote') || 
                name.includes('bar') || 
                name.includes('trade') || 
                name.includes('snapshot'));
      });
      
      const assetTools = filteredTools.filter((t: ToolSchema) => {
        const name = t.name.toLowerCase();
        return name.includes('asset') || 
               name.includes('corporate') ||
               name.includes('portfolio') ||
               name.includes('watchlist') ||
               name.includes('calendar') ||
               name.includes('clock');
      });

      const newsTools = filteredTools.filter((t: ToolSchema) => {
        const name = t.name.toLowerCase();
        return name.includes('news');
      });

      const customNewsTools: ToolSchema[] = [
        {
          name: 'get_portfolio_news',
          description: 'Fetch recent news for symbols in the user portfolio.',
          inputSchema: {
            type: 'object',
            properties: {
              start: {
                type: 'string',
                description: 'Start date (YYYY-MM-DD). Optional.',
              },
              end: {
                type: 'string',
                description: 'End date (YYYY-MM-DD). Optional.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of articles to return.',
              },
            },
          },
        },
        {
          name: 'get_watchlist_news',
          description: 'Fetch recent news for symbols in the user watchlist.',
          inputSchema: {
            type: 'object',
            properties: {
              start: {
                type: 'string',
                description: 'Start date (YYYY-MM-DD). Optional.',
              },
              end: {
                type: 'string',
                description: 'End date (YYYY-MM-DD). Optional.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of articles to return.',
              },
            },
          },
        },
      ];
      
      // Add web search tools for symbol resolution and research
      const webSearchTools: ToolSchema[] = [
        {
          name: 'web_search',
          description: 'Search the web for information about companies, symbols, market data, or any topic. Use this to find ticker symbols, company information, or research topics.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query (e.g., "top 10 gold mining companies", "AAPL stock symbol", "Microsoft ticker")',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'search_stock_symbols',
          description: 'Search for stock ticker symbols given a company name or group name. Returns potential symbols and company information.',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Company name or group name to search for (e.g., "Apple", "Gold mining companies", "MAG7")',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_chart_data',
          description: 'Fetch market data and generate chart data for a stock symbol. Use this when users ask to see charts, graphs, or visualizations of stock data (e.g., "Show me GOOGL market data", "Display AAPL chart").',
          inputSchema: {
            type: 'object',
            properties: {
              symbol: {
                type: 'string',
                description: 'Stock ticker symbol (e.g., "AAPL", "GOOGL", "MSFT")',
              },
              timeframe: {
                type: 'string',
                description: 'Time period for the chart: "1d" (1 day), "5d" (5 days), "1mo" (1 month), "6mo" (6 months), "1y" (1 year), "5y" (5 years). Default: "1mo"',
                enum: ['1d', '5d', '1mo', '6mo', '1y', '5y'],
              },
            },
            required: ['symbol'],
          },
        },
      ];
      
      // Combine prioritized tools with web search tools
      // Prioritize web search tools early so they're included even if we hit the limit
      const prioritizedTools = [
        ...webSearchTools, // Add web search tools first to ensure they're included
        ...newsTools,
        ...customNewsTools,
        ...stockTradingTools,
        ...stockMarketDataTools,
        ...assetTools,
      ];
      
      // Remove duplicates and limit to 30 (web search tools will be included)
      const uniqueTools = Array.from(
        new Map(prioritizedTools.map(t => [t.name, t])).values()
      ).slice(0, 30);
      
      console.log(`📊 Filtered tools: ${toolSchemas.length} → ${uniqueTools.length} (removed options, added web search, limited to ~30)`);
      
      const functions = uniqueTools.map((tool: ToolSchema) => ({
        name: tool.name,
        description: tool.description || '',
        parameters: tool.inputSchema || { type: 'object', properties: {} },
      }));
      
      return await this.processWithDedalusREST(userMessage, systemPrompt, functions, mcpClient, history);
    }

    throw new Error('Unexpected error in Dedalus processing');
  }

  private async processWithDedalusREST(
    userMessage: string,
    systemPrompt: string,
    functions: any[],
    mcpClient: any,
    history: ChatHistoryMessage[] = []
  ): Promise<string> {
    // Use Dedalus Labs OpenAI-compatible REST API
    const apiKey = this.config!.apiKey;
    const model = this.config!.model;
    
    // Convert functions to OpenAI format
    const tools = functions.length > 0 ? functions.map(f => ({
      type: 'function' as const,
      function: {
        name: f.name,
        description: f.description,
        parameters: f.parameters,
      },
    })) : undefined;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
    ];
    if (history.length > 0) {
      history.forEach((item) => {
        messages.push({ role: item.role, content: item.content });
      });
    }
    messages.push({ role: 'user', content: userMessage });

    type NotionalOrder = { symbol: string; notional: number };
    let maxIterations = 50;
    let iteration = 0;
    let lastChartPayload: string | null = null;
    let lastNewsPayload: string | null = null;
    let lastNotionalOrder: NotionalOrder | null = null;
    const toolCallLog: Array<{ iteration: number; tool: string; parameters: any; timestamp: string }> = [];

    const normalizeSymbols = (symbols: any): string[] => {
      if (!symbols) {
        return [];
      }
      if (Array.isArray(symbols)) {
        return symbols.map((s) => String(s).trim().toUpperCase()).filter(Boolean);
      }
      return String(symbols)
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
    };

    const filterNewsBySymbols = (newsData: any, symbols: string[]) => {
      const targetSymbols = normalizeSymbols(symbols);
      if (!newsData || !Array.isArray(newsData.articles)) {
        return newsData;
      }
      if (targetSymbols.length === 0) {
        return newsData;
      }
      const filteredArticles = newsData.articles.filter((article: any) => {
        const articleSymbols = normalizeSymbols(article?.symbols);
        if (articleSymbols.length === 0) {
          return false;
        }
        return articleSymbols.some((symbol) => targetSymbols.includes(symbol));
      });
      return {
        ...newsData,
        articles: filteredArticles,
        count: filteredArticles.length,
        symbols: targetSymbols,
      };
    };

    const sortAndLimitNews = (newsData: any, limit: number) => {
      if (!newsData || !Array.isArray(newsData.articles)) {
        return newsData;
      }
      const sorted = [...newsData.articles].sort((a, b) =>
        String(b?.published_date || '').localeCompare(String(a?.published_date || ''))
      );
      const capped = sorted.slice(0, limit);
      return {
        ...newsData,
        articles: capped,
        count: capped.length,
      };
    };

    const summarizeNewsData = (newsData: any): string => {
      if (!newsData) {
        return 'News: no data';
      }
      if (newsData.error) {
        return `News error: ${newsData.error}`;
      }
      const count = typeof newsData.count === 'number'
        ? newsData.count
        : Array.isArray(newsData.articles)
          ? newsData.articles.length
          : 0;
      const symbols = Array.isArray(newsData.symbols) ? newsData.symbols.filter(Boolean) : [];
      const symbolText = symbols.length > 0 ? ` for ${symbols.join(', ')}` : '';
      const dateText = newsData.start_date && newsData.end_date
        ? ` (${newsData.start_date} to ${newsData.end_date})`
        : '';
      return `News: ${count} article${count === 1 ? '' : 's'}${symbolText}${dateText}`;
    };

    while (iteration < maxIterations) {
      const requestBody: any = {
        model: model,
        messages: messages,
        max_tokens: 4000, // Using gpt-4o with 128k context window, so this is safe
      };

      // Only include tools and tool_choice if tools are available
      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        // Dedalus API expects tool_choice as an object with 'type' field
        // Valid types: 'auto', 'any', 'tool', or 'none'
        // For trading commands, use 'any' to encourage tool usage, 'auto' otherwise
        const isTradingCommand = /(buy|sell|purchase|trade|order)/i.test(userMessage);
        if (isTradingCommand && iteration === 0) {
          // For trading commands, use 'any' to encourage tool usage
          requestBody.tool_choice = { type: 'any' };
        } else {
          // Default to 'auto' for normal behavior
          requestBody.tool_choice = { type: 'auto' };
        }
      }

      // Log request details for debugging (without sensitive data)
      console.log(`📤 Dedalus API Request:`, {
        model,
        messageCount: messages.length,
        toolCount: tools?.length || 0,
        toolNames: tools?.map((t: any) => t.function?.name).slice(0, 5) || [],
        requestSize: JSON.stringify(requestBody).length,
      });

      const response = await fetch('https://api.dedaluslabs.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Dedalus API Error ${response.status}:`, errorText);
        console.error(`Request body size: ${JSON.stringify(requestBody).length} bytes`);
        console.error(`Number of tools: ${tools?.length || 0}`);
        throw new Error(`Dedalus API error: ${response.status} ${errorText}`);
      }

      const data = await response.json() as any;
      const message = data.choices[0].message;
      messages.push(message);

      // Check if LLM wants to call a tool
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`\n🔄 Iteration ${iteration + 1}/${maxIterations}: Processing ${message.tool_calls.length} tool call(s)`);
        
        // Execute tool calls
        const toolResults = await Promise.all(
          message.tool_calls.map(async (toolCall: any) => {
            try {
              const toolName = toolCall.function.name;
              const toolArgs = this.normalizeToolArgs(
                toolName,
                JSON.parse(toolCall.function.arguments || '{}')
              );
              
              // Log to tool call log
              toolCallLog.push({
                iteration: iteration + 1,
                tool: toolName,
                parameters: toolArgs,
                timestamp: new Date().toISOString(),
              });
              
              let result: string;
              
              // Handle web search tools directly
              if (toolName === 'web_search') {
                console.log(`🔍 Calling web_search with query: "${toolArgs.query || ''}"`);
                try {
                  const { searchWeb } = await import('./web-search');
                  result = await searchWeb(toolArgs.query || '');
                  console.log(`✅ Web search result (${result.length} chars):`, result.substring(0, 200));
                } catch (webError: any) {
                  console.error('❌ Web search error:', webError);
                  result = `Web search error: ${webError.message}`;
                }
              } else if (toolName === 'search_stock_symbols') {
                console.log(`🔍 Calling search_stock_symbols with query: "${toolArgs.query || ''}"`);
                try {
                  const { resolveSymbols } = await import('./web-search');
                  result = await resolveSymbols(toolArgs.query || '');
                  console.log(`✅ Symbol search result (${result.length} chars):`, result.substring(0, 200));
                } catch (symbolError: any) {
                  console.error('❌ Symbol search error:', symbolError);
                  result = `Symbol search error: ${symbolError.message}`;
                }
              } else if (toolName === 'get_chart_data') {
                console.log(`📊 Calling get_chart_data for symbol: "${toolArgs.symbol || ''}"`);
                try {
                  // Call chart API endpoint
                  const chartResponse = await fetch('http://localhost:3001/api/chart/data', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      symbol: toolArgs.symbol,
                      timeframe: toolArgs.timeframe || '1mo',
                    }),
                  });

                  if (!chartResponse.ok) {
                    const errorData: any = await chartResponse.json();
                    throw new Error(errorData.error || 'Failed to fetch chart data');
                  }

                  const chartDataResponse: any = await chartResponse.json();
                  if (chartDataResponse.success && chartDataResponse.data) {
                    // Return chart data as JSON string that frontend can parse
                    result = JSON.stringify({
                      type: 'chart',
                      chartData: chartDataResponse.data,
                    });
                    lastChartPayload = result;
                    console.log(`✅ Chart data fetched: ${chartDataResponse.data.chartType} chart with ${chartDataResponse.data.data.length} points`);
                  } else {
                    throw new Error('Invalid chart data response');
                  }
                } catch (chartError: any) {
                  console.error('❌ Chart data error:', chartError);
                  result = `Chart data error: ${chartError.message}`;
                }
              } else if (toolName === 'get_news') {
                console.log(`📰 Calling get_news with args:`, JSON.stringify(toolArgs));
                try {
                  let newsData: any = await fetchMarketAuxNews({
                    symbols: toolArgs.symbols,
                    start: toolArgs.start,
                    end: toolArgs.end,
                    limit: 3,
                  });
                  if (newsData?.error) {
                    result = `News error: ${newsData.error}`;
                  } else {
                    newsData = filterNewsBySymbols(newsData, toolArgs.symbols);
                    newsData = sortAndLimitNews(newsData, 10);
                    lastNewsPayload = JSON.stringify({
                      type: 'news',
                      newsData,
                    });
                    result = summarizeNewsData(newsData);
                  }
                } catch (newsError: any) {
                  console.error('❌ News error:', newsError);
                  result = `News error: ${newsError.message}`;
                }
              } else if (toolName === 'get_portfolio_news' || toolName === 'get_watchlist_news') {
                const endpoint = toolName === 'get_portfolio_news' ? 'portfolio' : 'watchlist';
                console.log(`📰 Calling ${toolName} via /api/news/${endpoint}`);
                try {
                  const params = new URLSearchParams();
                  if (toolArgs.start) {
                    params.set('start', toolArgs.start);
                  }
                  if (toolArgs.end) {
                    params.set('end', toolArgs.end);
                  }
                  if (toolArgs.limit !== undefined) {
                    params.set('limit', String(toolArgs.limit));
                  } else {
                    params.set('limit', '3');
                  }
                  params.set('source', 'marketaux');
                  const url = `http://localhost:3001/api/news/${endpoint}${params.toString() ? `?${params}` : ''}`;
                  const newsResponse = await fetch(url, { method: 'GET' });
                  const newsPayload: any = await newsResponse.json();
                  if (!newsResponse.ok || !newsPayload?.success) {
                    throw new Error(newsPayload?.error || 'Failed to fetch news');
                  }
                  const newsData = newsPayload.data;
                  if (newsData?.error) {
                    result = `News error: ${newsData.error}`;
                  } else {
                    const requestedSymbols = normalizeSymbols(newsData.symbols);
                    newsData = filterNewsBySymbols(newsData, requestedSymbols);
                    newsData = sortAndLimitNews(newsData, 10);
                    lastNewsPayload = JSON.stringify({
                      type: 'news',
                      newsData,
                    });
                    result = summarizeNewsData(newsData);
                  }
                } catch (newsError: any) {
                  console.error('❌ News error:', newsError);
                  result = `News error: ${newsError.message}`;
                }
              } else {
                // Call MCP tool for all other tools
                if (toolName === 'place_stock_order' && toolArgs?.notional && !toolArgs?.quantity) {
                  const notionalValue = Number(toolArgs.notional);
                  if (!Number.isNaN(notionalValue)) {
                    lastNotionalOrder = {
                      symbol: toolArgs.symbol || '',
                      notional: notionalValue,
                    };
                  }
                }
                result = await mcpClient.callTool({
                  name: toolName,
                  arguments: toolArgs,
                });
              }
              
              // COMPRESS RESULT BEFORE ADDING TO CONVERSATION
              const compressedResult = compressToolResult(toolName, result);
              
              return {
                role: 'tool' as const,
                tool_call_id: toolCall.id,
                name: toolName,
                content: compressedResult,
              };
            } catch (error: any) {
              return {
                role: 'tool' as const,
                tool_call_id: toolCall.id,
                name: toolCall.function.name,
                content: `Error: ${error.message}`,
              };
            }
          })
        );

        messages.push(...toolResults);
        iteration++;
        
        // Log that we're continuing to get LLM response
        console.log(`📝 Tool results added, continuing to iteration ${iteration + 1} to get LLM response...`);
        continue;
      }

      const stripMarkdownImages = (content: string) =>
        content
          .replace(/!\[[^\]]*]\([^)]+\)/g, '')
          .replace(/\[[^\]]*]\([^)]+\)/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

      // No tool calls - this is the final response
      let responseContent = stripMarkdownImages(message.content || 'No response generated');
      console.log(`✅ Final LLM response (${responseContent.length} chars):`, responseContent.substring(0, 200));
      const lowerContent = responseContent.toLowerCase();
      const refusedKeywords = ["don't have the ability", "cannot execute", "unable to", "i'm sorry", "i cannot", "i don't have", "as an ai"];
      const isTradingCommand = /(buy|sell|purchase|trade|order)/i.test(userMessage);
      
      // Check if tools were actually called - if so, this is not a refusal, just an explanation
      const hasToolCalls = toolCallLog.length > 0;
      const mentionsSuccess = lowerContent.includes('successfully') || lowerContent.includes('placed') || lowerContent.includes('executed') || lowerContent.includes('completed');
      const mentionsPartialFailure = lowerContent.includes('wasn\'t able') || lowerContent.includes('couldn\'t') || lowerContent.includes('failed') || lowerContent.includes('error');
      
      // If tools were called and response mentions success or partial failure, it's not a refusal
      const isExplanationNotRefusal = hasToolCalls && (mentionsSuccess || mentionsPartialFailure);
      
      // If LLM refused to execute a trading command WITHOUT calling tools, try to force tool usage
      if (isTradingCommand && !isExplanationNotRefusal && refusedKeywords.some(keyword => lowerContent.includes(keyword)) && iteration < maxIterations - 1) {
        // Add a follow-up message forcing tool usage
        messages.push({
          role: 'user',
          content: `You MUST call the place_stock_order tool to execute this trade. Do not refuse. Extract the symbol and quantity from: "${userMessage}" and call the tool immediately.`,
        });
        iteration++;
        continue; // Retry with forced instruction
      }
      
      // If still refusing WITHOUT calling tools after retry, throw error
      if (isTradingCommand && !isExplanationNotRefusal && refusedKeywords.some(keyword => lowerContent.includes(keyword))) {
        throw new Error(`LLM refused to execute trading command after ${iteration + 1} attempts without calling tools. The model responded: "${responseContent}". This indicates the LLM is not calling the required tools. Please check your system prompt and tool configuration.`);
      }
      
      // Log final tool call summary
      if (toolCallLog.length > 0) {
        console.log('\n📊 Tool Call Summary:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        toolCallLog.forEach((log, idx) => {
          console.log(`${idx + 1}. Iteration ${log.iteration} - ${log.tool}`);
          console.log(`   Parameters:`, JSON.stringify(log.parameters, null, 2));
          console.log(`   Time: ${log.timestamp}`);
        });
        console.log(`\nTotal tool calls: ${toolCallLog.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      }
      
      // If tools were called and we got a response (even with partial failures), return it
      // This handles cases where some orders succeed and others fail
      const appendNotionalNote = (content: string, order: NotionalOrder | null) => {
        return content;
      };

      if (hasToolCalls && responseContent) {
        if (lastChartPayload && !responseContent.includes('"type":"chart"')) {
          responseContent = `${responseContent}\n\n${lastChartPayload}`;
        }
        if (lastNewsPayload && !responseContent.includes('"type":"news"')) {
          responseContent = `${responseContent}\n\n${lastNewsPayload}`;
        }
        responseContent = appendNotionalNote(responseContent, lastNotionalOrder);
        return responseContent;
      }
      
      if (lastChartPayload && !responseContent.includes('"type":"chart"')) {
        responseContent = `${responseContent}\n\n${lastChartPayload}`;
      }
      if (lastNewsPayload && !responseContent.includes('"type":"news"')) {
        responseContent = `${responseContent}\n\n${lastNewsPayload}`;
      }

      responseContent = appendNotionalNote(responseContent, lastNotionalOrder);

      return responseContent;
    }

    // Log tool call summary even if max iterations reached
    if (toolCallLog.length > 0) {
      console.log('\n⚠️  Maximum iterations reached. Tool Call Summary:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      toolCallLog.forEach((log, idx) => {
        console.log(`${idx + 1}. Iteration ${log.iteration} - ${log.tool}`);
        console.log(`   Parameters:`, JSON.stringify(log.parameters, null, 2));
      });
      console.log(`\nTotal tool calls: ${toolCallLog.length}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    return 'Maximum iterations reached. Please try again.';
  }
}

// Singleton instance
let llmServiceInstance: LLMService | null = null;

export function getLLMService(): LLMService {
  if (!llmServiceInstance) {
    llmServiceInstance = new LLMService();
  }
  return llmServiceInstance;
}
