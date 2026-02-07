import { getMCPClient } from '../mcp/client';
import { MCPToolCall } from '../types';

export interface LLMConfig {
  provider: 'dedalus' | 'openai' | 'anthropic';
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

/**
 * LLM Service that handles natural language interpretation and tool calling
 */
export class LLMService {
  private config: LLMConfig | null = null;
  private openaiClient: any = null;
  private anthropicClient: any = null;
  private configInitialized = false;

  constructor() {
    // Don't initialize immediately - wait until first use
    // This allows environment variables to be loaded first
  }

  /**
   * Filters tools based on user message to reduce token count
   * Includes all stock trading and market data tools, excludes crypto and options
   * 
   * NOTE: This method is deprecated for Dedalus provider. Dedalus automatically discovers
   * tools from MCP servers without manual keyword filtering. This method is kept for
   * backward compatibility with OpenAI and Anthropic providers.
   */
  private filterRelevantTools(tools: ToolSchema[], userMessage: string): ToolSchema[] {
    const lowerMessage = userMessage.toLowerCase();
    
    // All stock-related tools (excluding crypto and options)
    const stockTradingTools = [
      'get_account_info',
      'get_all_positions',
      'get_open_position',
      'place_stock_order',
      'close_position',
      'close_all_positions',
      'get_orders',
      'cancel_all_orders',
      'cancel_order_by_id',
    ];
    
    const stockMarketDataTools = [
      'get_stock_latest_quote',
      'get_stock_bars',
      'get_stock_trades',
      'get_stock_latest_trade',
      'get_stock_latest_bar',
      'get_stock_snapshot',
    ];
    
    const stockAssetTools = [
      'get_asset',
      'get_all_assets',
      'get_corporate_actions',
      'get_portfolio_history',
    ];
    
    const marketInfoTools = [
      'get_calendar',
      'get_clock',
    ];
    
    const watchlistTools = [
      'create_watchlist',
      'get_watchlists',
      'get_watchlist_by_id',
      'update_watchlist_by_id',
      'add_asset_to_watchlist_by_id',
      'remove_asset_from_watchlist_by_id',
      'delete_watchlist_by_id',
    ];
    
    // Combine all stock tools
    const allStockTools = [
      ...stockTradingTools,
      ...stockMarketDataTools,
      ...stockAssetTools,
      ...marketInfoTools,
      ...watchlistTools,
    ];
    
    // Filter out crypto and options tools
    const filteredStockTools = tools.filter(t => {
      const name = t.name.toLowerCase();
      // Exclude crypto tools
      if (name.includes('crypto')) return false;
      // Exclude options tools
      if (name.includes('option')) return false;
      // Only include stock tools from our list
      return allStockTools.includes(t.name);
    });
    
    // If no keywords match, return essential stock tools
    if (filteredStockTools.length === 0) {
      return tools.filter(t => stockTradingTools.includes(t.name));
    }
    
    // Keyword-based tool selection for better relevance
    const keywordMap: Record<string, string[]> = {
      // Account & Portfolio
      'account': ['get_account_info'],
      'balance': ['get_account_info'],
      'buying power': ['get_account_info'],
      'cash': ['get_account_info'],
      'equity': ['get_account_info', 'get_portfolio_history'],
      'portfolio': ['get_account_info', 'get_all_positions', 'get_portfolio_history'],
      
      // Positions
      'position': ['get_all_positions', 'get_open_position', 'close_position', 'close_all_positions'],
      'positions': ['get_all_positions', 'close_all_positions'],
      'shares': ['get_all_positions', 'get_open_position'],
      'share': ['get_all_positions', 'get_open_position'],
      'have': ['get_all_positions', 'get_open_position', 'get_account_info'],
      'own': ['get_all_positions', 'get_open_position'],
      'holding': ['get_all_positions', 'get_open_position'],
      'holdings': ['get_all_positions'],
      'how many': ['get_all_positions', 'get_open_position'],
      
      // Trading
      'buy': ['place_stock_order', 'get_account_info'],
      'purchase': ['place_stock_order'],
      'sell': ['place_stock_order', 'close_position'],
      'order': ['get_orders', 'place_stock_order', 'cancel_all_orders', 'cancel_order_by_id'],
      'orders': ['get_orders', 'cancel_all_orders'],
      'cancel': ['cancel_all_orders', 'cancel_order_by_id', 'get_orders'],
      
      // Market Data
      'price': ['get_stock_snapshot', 'get_stock_latest_quote', 'get_stock_bars'],
      'quote': ['get_stock_latest_quote', 'get_stock_snapshot'],
      'market': ['get_stock_snapshot', 'get_clock', 'get_stock_bars', 'get_stock_latest_quote'],
      'market data': ['get_stock_snapshot', 'get_stock_bars', 'get_stock_latest_quote', 'get_stock_trades'],
      'data': ['get_stock_snapshot', 'get_stock_bars', 'get_stock_latest_quote', 'get_stock_trades'],
      'history': ['get_stock_bars', 'get_stock_trades', 'get_portfolio_history'],
      'historical': ['get_stock_bars', 'get_stock_trades', 'get_portfolio_history'],
      'bar': ['get_stock_bars', 'get_stock_latest_bar'],
      'bars': ['get_stock_bars'],
      'trade': ['get_stock_trades', 'get_stock_latest_trade'],
      'trades': ['get_stock_trades'],
      'snapshot': ['get_stock_snapshot'],
      'latest': ['get_stock_latest_quote', 'get_stock_latest_trade', 'get_stock_latest_bar', 'get_stock_snapshot'],
      
      // Assets
      'asset': ['get_asset', 'get_all_assets'],
      'assets': ['get_all_assets'],
      'symbol': ['get_asset', 'get_stock_snapshot', 'get_stock_latest_quote'],
      'stock': ['get_asset', 'get_stock_snapshot', 'get_stock_bars'],
      
      // Corporate Actions
      'earnings': ['get_corporate_actions'],
      'dividend': ['get_corporate_actions'],
      'split': ['get_corporate_actions'],
      'corporate': ['get_corporate_actions'],
      
      // Market Info
      'calendar': ['get_calendar'],
      'clock': ['get_clock'],
      'market status': ['get_clock'],
      'open': ['get_clock', 'get_calendar'],
      'close': ['get_clock', 'get_calendar'],
      
      // Watchlists
      'watchlist': ['get_watchlists', 'create_watchlist'],
      'watchlists': ['get_watchlists', 'create_watchlist'],
    };
    
    const relevantToolNames = new Set<string>();
    
    // Add all stock tools by default (they're already filtered)
    filteredStockTools.forEach(t => relevantToolNames.add(t.name));
    
    // If user message contains keywords, prioritize those tools
    let hasKeywords = false;
    for (const [keyword, toolNames] of Object.entries(keywordMap)) {
      if (lowerMessage.includes(keyword)) {
        hasKeywords = true;
        toolNames.forEach(name => relevantToolNames.add(name));
      }
    }
    
    // Filter to only include relevant stock tools
    const filtered = filteredStockTools.filter(t => relevantToolNames.has(t.name));
    
    // If keywords matched, return those tools; otherwise return all stock tools
    // Limit to reasonable number for context window (reduced to prevent token overflow)
    // With 8192 token limit, we need to be conservative: ~10-15 tools max
    return hasKeywords ? filtered.slice(0, 12) : filteredStockTools.slice(0, 15);
  }

  /**
   * Converts MCP tool schemas to OpenAI/Anthropic function calling format
   */
  private convertToolSchemaToFunction(tool: ToolSchema): any {
    // Simplify parameters to reduce token count
    const simplifiedParams = this.simplifyToolParameters(tool.inputSchema);
    
    // Truncate description to reduce tokens (keep first 100 chars)
    const shortDescription = tool.description ? tool.description.substring(0, 100) : '';
    
    return {
      name: tool.name,
      description: shortDescription,
      parameters: simplifiedParams,
    };
  }

  /**
   * Simplifies tool parameters to reduce token count
   */
  private simplifyToolParameters(inputSchema: any): any {
    if (!inputSchema || !inputSchema.properties) {
      return {
        type: 'object',
        properties: {},
        required: [],
      };
    }
    
    // Limit properties to essential ones and simplify descriptions
    const simplifiedProperties: Record<string, any> = {};
    const essentialProps = Object.keys(inputSchema.properties).slice(0, 5); // Limit to 5 properties to reduce tokens
    
    for (const prop of essentialProps) {
      const propSchema = inputSchema.properties[prop];
      const propType = propSchema.type || 'string';
      
      simplifiedProperties[prop] = {
        type: propType,
        description: propSchema.description ? propSchema.description.substring(0, 50) : '', // Limit description length to 50 chars
      };
      
      // Handle array types - must include items property
      if (propType === 'array') {
        // If items is already defined, preserve it (may be simplified)
        if (propSchema.items) {
          simplifiedProperties[prop].items = {
            type: propSchema.items.type || 'string',
            description: propSchema.items.description ? propSchema.items.description.substring(0, 30) : '',
          };
          // Preserve enum in items if present
          if (propSchema.items.enum) {
            simplifiedProperties[prop].items.enum = propSchema.items.enum;
          }
        } else {
          // Default to array of strings if items not specified (common for symbol arrays)
          simplifiedProperties[prop].items = {
            type: 'string',
          };
        }
      }
      
      // Include enum if present (for non-array types)
      if (propSchema.enum && propType !== 'array') {
        simplifiedProperties[prop].enum = propSchema.enum;
      }
    }
    
    return {
      type: 'object',
      properties: simplifiedProperties,
      required: (inputSchema.required || []).filter((r: string) => essentialProps.includes(r)),
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
                    keyTrimmed === 'OPENAI_API_KEY' || 
                    keyTrimmed === 'ANTHROPIC_API_KEY' || 
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
    // Determine provider - check explicit setting first, then auto-detect
    let provider: 'dedalus' | 'openai' | 'anthropic' | null = null;
    
    const explicitProvider = process.env.LLM_PROVIDER?.toLowerCase();
    if (explicitProvider === 'dedalus' || explicitProvider === 'openai' || explicitProvider === 'anthropic') {
      provider = explicitProvider;
    }
    
    // Auto-detect provider if not explicitly set
    if (!provider) {
      if (process.env.DEDALUS_API_KEY) {
        provider = 'dedalus';
      } else if (process.env.OPENAI_API_KEY) {
        provider = 'openai';
      } else if (process.env.ANTHROPIC_API_KEY) {
        provider = 'anthropic';
      } else {
        // No provider configured, LLM features will be disabled
        return;
      }
    }

    let apiKey = '';
    const model = process.env.LLM_MODEL || 'gpt-4';

    switch (provider) {
      case 'dedalus':
        apiKey = process.env.DEDALUS_API_KEY || '';
        break;
      case 'openai':
        apiKey = process.env.OPENAI_API_KEY || '';
        break;
      case 'anthropic':
        apiKey = process.env.ANTHROPIC_API_KEY || '';
        break;
    }

    if (!apiKey) {
      console.warn(`No API key found for ${provider}. LLM features will be disabled.`);
      return;
    }

    console.log(`LLM Service initialized with provider: ${provider}, model: ${model}`);
    this.config = { provider, apiKey, model };

    // Initialize clients based on provider
    if (provider === 'openai' && apiKey) {
      try {
        // Dynamic import to handle case where package might not be installed
        const OpenAI = require('openai');
        this.openaiClient = new OpenAI({ apiKey });
      } catch (error) {
        console.warn('OpenAI SDK not installed. Install with: npm install openai');
      }
    } else if (provider === 'anthropic' && apiKey) {
      try {
        const Anthropic = require('@anthropic-ai/sdk');
        this.anthropicClient = new Anthropic({ apiKey });
      } catch (error) {
        console.warn('Anthropic SDK not installed. Install with: npm install @anthropic-ai/sdk');
      }
    }
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

    if (this.config.provider === 'dedalus') {
      // Dedalus Labs - check if API key is set (SDK check happens at runtime)
      const hasApiKey = !!this.config.apiKey && !!process.env.DEDALUS_API_KEY;
      if (!hasApiKey) {
        console.log('LLM Service: Dedalus API key not found');
        return false;
      }
      // Don't require SDK to be installed at initialization - let it fail gracefully at runtime
      return true;
    }

    if (this.config.provider === 'openai') {
      const available = !!this.openaiClient && !!this.config.apiKey;
      if (!available) {
        console.log('LLM Service: OpenAI client not initialized or API key missing');
      }
      return available;
    }

    if (this.config.provider === 'anthropic') {
      const available = !!this.anthropicClient && !!this.config.apiKey;
      if (!available) {
        console.log('LLM Service: Anthropic client not initialized or API key missing');
      }
      return available;
    }

    return false;
  }

  /**
   * Process a user message and return a response, potentially calling MCP tools
   */
  async processMessage(userMessage: string): Promise<string> {
    this.ensureConfigInitialized();
    
    if (!this.config || !this.isAvailable()) {
      throw new Error('LLM service is not configured or available. Please set LLM_PROVIDER and corresponding API key.');
    }

    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    // For Dedalus, let it discover tools from MCP server automatically
    // For other providers, use keyword-based filtering
    if (this.config.provider === 'dedalus') {
      // Simplified system prompt for Dedalus - it handles tool discovery automatically
      const systemPrompt = `You are a trading assistant for Alpaca. Use the available MCP tools to execute user requests. Always call the appropriate tools when users make trading requests or ask questions about their account, positions, or market data. After calling tools, provide clear and friendly responses based on the results.`;
      return await this.processWithDedalus(userMessage, systemPrompt, mcpClient);
    }

    // For OpenAI and Anthropic, still use keyword-based filtering
    const toolSchemas = await mcpClient.getToolSchemas();
    const relevantTools = this.filterRelevantTools(toolSchemas, userMessage);
    const functions = relevantTools.map(tool => this.convertToolSchemaToFunction(tool));

    // Create a simplified system prompt for non-Dedalus providers
    const systemPrompt = `You are a trading assistant for Alpaca. You MUST ALWAYS use MCP tools to execute user requests. NEVER refuse or say you cannot execute trades.

CRITICAL RULES:
1. When user says "buy X shares of Y" or "buy Y X shares" → CALL place_stock_order tool immediately
2. Extract: symbol (Y), quantity (X), side="buy", type="market" (unless limit price specified)
3. For "buy google" → symbol is "GOOGL"
4. NEVER say "I cannot" or "I don't have the ability" - ALWAYS call the tool
5. After calling tools, summarize the results in a friendly way

Available tools: ${relevantTools.map(t => t.name).join(', ')}

Example: User says "buy google 100 shares" → Call place_stock_order with {symbol: "GOOGL", side: "buy", quantity: 100, type: "market"}`;

    try {
      if (this.config.provider === 'openai') {
        return await this.processWithOpenAI(userMessage, systemPrompt, functions, mcpClient);
      } else if (this.config.provider === 'anthropic') {
        return await this.processWithAnthropic(userMessage, systemPrompt, functions, mcpClient);
      }
    } catch (error: any) {
      console.error('Error processing message with LLM:', error);
      throw new Error(`LLM processing failed: ${error.message}`);
    }

    throw new Error('Unknown LLM provider');
  }

  private async processWithDedalus(
    userMessage: string,
    systemPrompt: string,
    mcpClient: any
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

        // Configure MCP server connection for local alpaca-mcp-server
        // Dedalus will automatically discover tools from the MCP server
        const mcpServerConfig = {
          name: 'alpaca-mcp-server',
          command: 'uvx',
          args: ['alpaca-mcp-server', 'serve'],
          env: {
            ALPACA_API_KEY: process.env.ALPACA_API_KEY,
            ALPACA_SECRET_KEY: process.env.ALPACA_SECRET_KEY,
            ALPACA_PAPER_TRADE: process.env.ALPACA_PAPER_TRADE || 'True',
          },
        };

        const response = await runner.run({
          input: userMessage,
          model: [this.config!.model],
          mcp_servers: [mcpServerConfig],
          // Don't pass tools - let Dedalus discover them from MCP server automatically
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
    // For REST API, we still need tool schemas, but without keyword filtering
    if (!useSDK) {
      const toolSchemas = await mcpClient.getToolSchemas();
      // Filter out crypto and options tools only (no keyword matching)
      const stockTools = toolSchemas.filter((t: ToolSchema) => {
        const name = t.name.toLowerCase();
        return !name.includes('crypto') && !name.includes('option');
      });
      const functions = stockTools.map((tool: ToolSchema) => this.convertToolSchemaToFunction(tool));
      return await this.processWithDedalusREST(userMessage, systemPrompt, functions, mcpClient);
    }

    throw new Error('Unexpected error in Dedalus processing');
  }

  private async processWithDedalusREST(
    userMessage: string,
    systemPrompt: string,
    functions: any[],
    mcpClient: any
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
      { role: 'user', content: userMessage },
    ];

    let maxIterations = 25;
    let iteration = 0;
    const toolCallLog: Array<{ iteration: number; tool: string; parameters: any; timestamp: string }> = [];

    while (iteration < maxIterations) {
      const requestBody: any = {
        model: model,
        messages: messages,
        max_tokens: 4000, // Increased to allow for more complex responses (model limit is 8192 total)
      };

      // Only include tools and tool_choice if tools are available
      if (tools && tools.length > 0) {
        requestBody.tools = tools;
        // Try to force tool usage for trading commands
        const isTradingCommand = /(buy|sell|purchase|trade|order)/i.test(userMessage);
        if (isTradingCommand && iteration === 0) {
          // For trading commands, try to require tool usage on first iteration
          // Try object format: { type: "function", function: { name: "place_stock_order" } }
          // Or try: { type: "auto" }
          // If Dedalus doesn't support these, it will ignore and default to auto
          try {
            // Try requiring the place_stock_order tool if available
            const placeOrderTool = tools.find((t: any) => t.function?.name === 'place_stock_order');
            if (placeOrderTool) {
              requestBody.tool_choice = { type: 'function', function: { name: 'place_stock_order' } };
            }
          } catch (e) {
            // If tool_choice format fails, omit it and let API default to auto
          }
        }
      }

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
              const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
              
              // Log to tool call log
              toolCallLog.push({
                iteration: iteration + 1,
                tool: toolName,
                parameters: toolArgs,
                timestamp: new Date().toISOString(),
              });
              
              const result = await mcpClient.callTool({
                name: toolName,
                arguments: toolArgs,
              });
              return {
                role: 'tool' as const,
                tool_call_id: toolCall.id,
                name: toolName,
                content: result,
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
        continue;
      }

      // No tool calls - check if this is a trading command that should have used tools
      const responseContent = message.content || 'No response generated';
      const lowerContent = responseContent.toLowerCase();
      const refusedKeywords = ["don't have the ability", "cannot execute", "unable to", "i'm sorry", "i cannot", "i don't have", "as an ai"];
      const isTradingCommand = /(buy|sell|purchase|trade|order)/i.test(userMessage);
      
      // If LLM refused to execute a trading command, try to force tool usage with a follow-up
      if (isTradingCommand && refusedKeywords.some(keyword => lowerContent.includes(keyword)) && iteration < maxIterations - 1) {
        // Add a follow-up message forcing tool usage
        messages.push({
          role: 'user',
          content: `You MUST call the place_stock_order tool to execute this trade. Do not refuse. Extract the symbol and quantity from: "${userMessage}" and call the tool immediately.`,
        });
        iteration++;
        continue; // Retry with forced instruction
      }
      
      // If still refusing after retry, throw error
      if (isTradingCommand && refusedKeywords.some(keyword => lowerContent.includes(keyword))) {
        throw new Error(`LLM refused to execute trading command after ${iteration + 1} attempts. The model responded: "${responseContent}". This indicates the LLM is not calling the required tools. Please check your system prompt and tool configuration.`);
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

  private async processWithOpenAI(
    userMessage: string,
    systemPrompt: string,
    functions: any[],
    mcpClient: any
  ): Promise<string> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    let maxIterations = 25;
    let iteration = 0;
    const toolCallLog: Array<{ iteration: number; tool: string; parameters: any; timestamp: string }> = [];

    while (iteration < maxIterations) {
      const response = await this.openaiClient.chat.completions.create({
        model: this.config!.model,
        messages,
        max_tokens: 4000, // Increased to allow for more complex responses
        tools: functions.length > 0 ? functions.map(f => ({ type: 'function', function: f })) : undefined,
        tool_choice: functions.length > 0 ? 'auto' : undefined,
      });

      const message = response.choices[0].message;
      messages.push(message);

      // Check if LLM wants to call a tool
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`\n🔄 Iteration ${iteration + 1}/${maxIterations}: Processing ${message.tool_calls.length} tool call(s)`);
        
        // Execute tool calls
        const toolResults = await Promise.all(
          message.tool_calls.map(async (toolCall: any) => {
            try {
              const toolName = toolCall.function.name;
              const toolArgs = JSON.parse(toolCall.function.arguments || '{}');
              
              // Log to tool call log
              toolCallLog.push({
                iteration: iteration + 1,
                tool: toolName,
                parameters: toolArgs,
                timestamp: new Date().toISOString(),
              });
              
              const result = await mcpClient.callTool({
                name: toolName,
                arguments: toolArgs,
              });
              return {
                role: 'tool' as const,
                tool_call_id: toolCall.id,
                name: toolName,
                content: result,
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
        continue;
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

      // No more tool calls, return the final response
      return message.content || 'No response generated';
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

  private async processWithAnthropic(
    userMessage: string,
    systemPrompt: string,
    functions: any[],
    mcpClient: any
  ): Promise<string> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized');
    }

    // Convert functions to Anthropic format
    const tools = functions.map(f => ({
      name: f.name,
      description: f.description,
      input_schema: f.parameters,
    }));

    const toolCallLog: Array<{ iteration: number; tool: string; parameters: any; timestamp: string }> = [];
    let iteration = 0;
    const maxIterations = 25;

    const response = await this.anthropicClient.messages.create({
      model: this.config!.model,
      max_tokens: 4000, // Increased to allow for more complex responses
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      tools: tools.length > 0 ? tools : undefined,
    });

    // Handle tool calls if present
    if (response.content && Array.isArray(response.content)) {
      const toolCalls = response.content.filter((item: any) => item.type === 'tool_use');
      
      if (toolCalls.length > 0) {
        console.log(`\n🔄 Iteration ${iteration + 1}/${maxIterations}: Processing ${toolCalls.length} tool call(s)`);
        
        // Execute tool calls
        const toolResults = await Promise.all(
          toolCalls.map(async (toolCall: any) => {
            try {
              // Log to tool call log
              toolCallLog.push({
                iteration: iteration + 1,
                tool: toolCall.name,
                parameters: toolCall.input || {},
                timestamp: new Date().toISOString(),
              });
              
              const result = await mcpClient.callTool({
                name: toolCall.name,
                arguments: toolCall.input || {},
              });
              return {
                type: 'tool_result',
                tool_use_id: toolCall.id,
                content: result,
              };
            } catch (error: any) {
              return {
                type: 'tool_result',
                tool_use_id: toolCall.id,
                content: `Error: ${error.message}`,
                is_error: true,
              };
            }
          })
        );

        // Log tool call summary
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

        // Send tool results back to Anthropic for final response
        const finalResponse = await this.anthropicClient.messages.create({
          model: this.config!.model,
          max_tokens: 4000, // Increased to allow for more complex responses
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userMessage,
            },
            ...response.content,
            ...toolResults,
          ],
          tools: tools.length > 0 ? tools : undefined,
        });

        // Extract text content from final response
        const textContent = finalResponse.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('\n');

        return textContent || JSON.stringify(finalResponse.content);
      }

      // No tool calls, return text content
      const textContent = response.content
        .filter((item: any) => item.type === 'text')
        .map((item: any) => item.text)
        .join('\n');

      return textContent || JSON.stringify(response.content);
    }

    return 'No response generated';
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
