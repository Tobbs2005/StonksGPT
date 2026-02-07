import { Router, Request, Response } from 'express';
import { getMCPClient } from '../mcp/client';
import { getLLMService } from '../llm/service';
import { MCPToolCall } from '../types';

const router = Router();

// Generic tool caller endpoint
router.post('/tool', async (req: Request, res: Response) => {
  try {
    const { name, arguments: args } = req.body as MCPToolCall;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required',
      });
    }

    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const result = await mcpClient.callTool({
      name,
      arguments: args || {},
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error calling tool:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to call tool',
    });
  }
});

// Natural language message endpoint
// Uses LLM to interpret messages and call appropriate MCP tools
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
      });
    }

    const llmService = getLLMService();

    // Try to use LLM service if available
    if (llmService.isAvailable()) {
      try {
        const result = await llmService.processMessage(message);
        return res.json({ success: true, data: result });
      } catch (error: any) {
        console.error('LLM processing error:', error);
        // Fall through to manual parsing fallback
        console.log('Falling back to manual parsing...');
      }
    }

    // Fallback to manual parsing if LLM is not available or fails
    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const tools = await mcpClient.listTools();
    const lowerMessage = message.toLowerCase().trim();
    let toolName = '';
    let args: Record<string, any> = {};

    // Parse natural language commands (fallback)
    // Account/Balance queries
    if (lowerMessage.match(/(account|balance|buying power|cash|equity|portfolio value)/i)) {
      toolName = 'get_account_info';
    }
    // Position queries
    else if (lowerMessage.match(/(position|positions|portfolio)/i)) {
      const symbolMatch = message.match(/\b([A-Z]{1,5})\b/);
      if (symbolMatch && (lowerMessage.includes('for') || lowerMessage.includes('in') || lowerMessage.includes('of'))) {
        toolName = 'get_open_position';
        args = { symbol: symbolMatch[1] };
      } else {
        toolName = 'get_all_positions';
      }
    }
    // Order queries
    else if (lowerMessage.match(/(order|orders|trade)/i)) {
      toolName = 'get_orders';
      if (lowerMessage.includes('open') || lowerMessage.includes('pending')) {
        args.status = 'open';
      } else if (lowerMessage.includes('filled') || lowerMessage.includes('completed')) {
        args.status = 'filled';
      } else if (lowerMessage.includes('cancel')) {
        args.status = 'canceled';
      }
    }
    // Buy orders
    else if (lowerMessage.match(/(buy|purchase)/i)) {
      const buyMatch = message.match(/(\d+)\s*(?:shares?|share)?\s*(?:of\s*)?([A-Z]{1,5})/i);
      if (buyMatch) {
        toolName = 'place_stock_order';
        args = {
          symbol: buyMatch[2],
          side: 'buy',
          quantity: parseFloat(buyMatch[1]),
          type: lowerMessage.includes('limit') ? 'limit' : 'market',
        };
        const priceMatch = message.match(/(?:at|@|\$)\s*(\d+\.?\d*)/i);
        if (priceMatch) {
          args.limit_price = parseFloat(priceMatch[1]);
          args.type = 'limit';
        }
      } else {
        toolName = 'get_account_info'; // Fallback
      }
    }
    // Sell orders
    else if (lowerMessage.match(/(sell|liquidate)/i)) {
      const sellMatch = message.match(/(\d+)\s*(?:shares?|share)?\s*(?:of\s*)?([A-Z]{1,5})/i);
      const closeMatch = message.match(/(?:close|liquidate)\s*(?:my\s*)?(?:entire\s*)?(?:position\s*)?(?:in\s*)?([A-Z]{1,5})/i);
      const percentMatch = message.match(/(\d+)%\s*(?:of\s*)?(?:my\s*)?(?:position\s*)?(?:in\s*)?([A-Z]{1,5})/i);
      
      if (percentMatch) {
        toolName = 'close_position';
        args = { symbol: percentMatch[2], percentage: percentMatch[1] };
      } else if (closeMatch) {
        toolName = 'close_position';
        args = { symbol: closeMatch[1] };
      } else if (sellMatch) {
        toolName = 'place_stock_order';
        args = {
          symbol: sellMatch[2],
          side: 'sell',
          quantity: parseFloat(sellMatch[1]),
          type: lowerMessage.includes('limit') ? 'limit' : 'market',
        };
        const priceMatch = message.match(/(?:at|@|\$)\s*(\d+\.?\d*)/i);
        if (priceMatch) {
          args.limit_price = parseFloat(priceMatch[1]);
          args.type = 'limit';
        }
      } else {
        toolName = 'get_all_positions'; // Fallback
      }
    }
    // Cancel orders
    else if (lowerMessage.match(/(cancel|delete)\s*(?:all\s*)?(?:open\s*)?(?:stock\s*)?orders?/i)) {
      if (lowerMessage.includes('all')) {
        toolName = 'cancel_all_orders';
      } else {
        const idMatch = message.match(/(?:order\s*)?(?:with\s*)?(?:id\s*)?([a-z0-9-]+)/i);
        if (idMatch) {
          // Cancel specific order - this would need to be handled differently
          toolName = 'get_orders';
        } else {
          toolName = 'cancel_all_orders';
        }
      }
    }
    // Market data queries
    else if (lowerMessage.match(/(price|quote|market|history|bar|trade)/i)) {
      const symbolMatch = message.match(/\b([A-Z]{1,5})\b/);
      if (symbolMatch) {
        const symbol = symbolMatch[1];
        if (lowerMessage.includes('history') || lowerMessage.includes('daily') || lowerMessage.includes('bar')) {
          toolName = 'get_stock_bars';
          args = { symbol: symbol };
          // Parse timeframe
          if (lowerMessage.includes('minute') || lowerMessage.includes('min')) {
            const minMatch = message.match(/(\d+)\s*(?:minute|min)/i);
            args.timeframe = minMatch ? `${minMatch[1]}Min` : '1Min';
          } else if (lowerMessage.includes('hour')) {
            const hourMatch = message.match(/(\d+)\s*hour/i);
            args.timeframe = hourMatch ? `${hourMatch[1]}Hour` : '1Hour';
          } else {
            args.timeframe = '1Day'; // Default to daily
          }
          // Parse days/hours/minutes
          if (lowerMessage.includes('5') || lowerMessage.includes('five')) {
            args.days = 5;
          } else if (lowerMessage.includes('last') || lowerMessage.includes('past')) {
            const dayMatch = message.match(/(\d+)\s*(?:day|days)/i);
            if (dayMatch) {
              args.days = parseInt(dayMatch[1]);
            }
          }
          if (lowerMessage.includes('limit') || lowerMessage.includes('last')) {
            const limitMatch = message.match(/(?:last|limit)\s*(\d+)/i);
            if (limitMatch) {
              args.limit = parseInt(limitMatch[1]);
            }
          }
        } else if (lowerMessage.includes('quote')) {
          toolName = 'get_stock_latest_quote';
          args = { symbol_or_symbols: symbol };
        } else if (lowerMessage.includes('trade')) {
          toolName = 'get_stock_latest_trade';
          args = { symbol_or_symbols: symbol };
        } else {
          toolName = 'get_stock_snapshot';
          args = { symbol_or_symbols: symbol };
        }
      } else {
        toolName = 'get_account_info'; // Fallback
      }
    }
    // Calendar queries
    else if (lowerMessage.match(/(calendar|market hours|trading days)/i)) {
      toolName = 'get_calendar';
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      args = {
        start_date: today.toISOString().split('T')[0],
        end_date: nextWeek.toISOString().split('T')[0],
      };
    }
    // Clock queries
    else if (lowerMessage.match(/(market status|market open|clock)/i)) {
      toolName = 'get_clock';
    }
    // Default fallback
    else {
      toolName = 'get_account_info';
    }

    if (!toolName || !tools.includes(toolName)) {
      return res.json({
        success: true,
        data: `I couldn't understand that command. Available tools: ${tools.slice(0, 10).join(', ')}...\n\nTry:\n- "Show my positions"\n- "What's my account balance?"\n- "Buy 5 shares of AAPL"\n- "Sell 10 shares of TSLA at $300"\n\nNote: For better natural language understanding, configure an LLM provider (OpenAI, Anthropic, or Dedalus Labs) by setting LLM_PROVIDER and the corresponding API key.`,
      });
    }

    const result = await mcpClient.callTool({ name: toolName, arguments: args });
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error processing message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process message',
    });
  }
});

// List available tools
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const mcpClient = getMCPClient();
    await mcpClient.initialize();

    const tools = await mcpClient.listTools();

    res.json({ success: true, data: tools });
  } catch (error: any) {
    console.error('Error listing tools:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to list tools',
    });
  }
});

export default router;
