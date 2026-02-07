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
    
    let errorMessage = error.message || 'Failed to call tool';
    let errorType = 'tool_error';
    let suggestions: string[] = [];
    
    // Provide better error messages for common tool errors
    const toolArgs = req.body.arguments || {};
    if (error.message?.includes('not recognize') || error.message?.includes('invalid asset')) {
      errorMessage = `The symbol "${toolArgs.symbol || 'unknown'}" was not recognized.`;
      suggestions = [
        'Verify the symbol is correct (e.g., AAPL, MSFT, GOOGL)',
        'Use get_asset tool to check if the symbol exists',
        'Check for typos in the symbol name',
      ];
    } else if (error.message?.includes('insufficient') || error.message?.includes('buying power')) {
      errorMessage = 'Insufficient buying power to execute this order.';
      suggestions = [
        'Check your account balance with get_account_info',
        'Reduce the order quantity',
        'Close existing positions to free up buying power',
      ];
    } else if (error.message?.includes('wash trade') || error.message?.includes('existing order')) {
      errorMessage = 'Cannot execute order due to conflicting existing orders.';
      suggestions = [
        'Check your existing orders with get_orders',
        'Cancel conflicting orders before placing a new one',
        'Wait for existing orders to fill or cancel',
      ];
    } else if (error.message?.includes('market closed')) {
      errorMessage = 'The market is currently closed.';
      suggestions = [
        'Check market hours with get_clock',
        'Use extended_hours=true for after-hours trading (if supported)',
        'Wait for market to open',
      ];
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      errorType,
      suggestions,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// LLM endpoint - processes natural language messages using Dedalus Labs MCP
router.post('/llm', async (req: Request, res: Response) => {
  // Set a timeout for the entire request (110 seconds to be slightly less than server timeout)
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        error: 'Request timeout - LLM processing took too long',
        errorType: 'timeout_error',
        suggestions: [
          'The request is taking longer than expected. This may happen with complex queries or web searches.',
          'Try simplifying your request or breaking it into smaller parts',
          'Check your internet connection',
          'Try again in a moment',
        ],
      });
    }
  }, 110000); // 110 seconds

  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      clearTimeout(timeout);
      return res.status(400).json({
        success: false,
        error: 'message is required and must be a string',
      });
    }

    const llmService = getLLMService();
    
    if (!llmService.isAvailable()) {
      clearTimeout(timeout);
      return res.status(503).json({
        success: false,
        error: 'LLM service is not configured. Please set LLM_PROVIDER and corresponding API key.',
      });
    }

    // Wrap LLM processing in a timeout promise
    const processPromise = llmService.processMessage(message);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('LLM processing timeout after 110 seconds')), 110000);
    });

    const result = await Promise.race([processPromise, timeoutPromise]);
    
    clearTimeout(timeout);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    clearTimeout(timeout);
    
    // Enhanced logging for timeout errors
    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      console.error('LLM request timeout:', {
        message: error.message,
        timestamp: new Date().toISOString(),
        userMessage: req.body?.message?.substring(0, 100) || 'N/A',
      });
    } else {
      console.error('Error processing message with LLM:', error);
    }
    
    // Parse error to provide better messages
    let errorMessage = error.message || 'Failed to process message';
    let errorType = 'unknown';
    let suggestions: string[] = [];
    
    // Categorize errors
    if (error.message?.includes('Dedalus API error')) {
      errorType = 'api_error';
      errorMessage = 'The AI service encountered an error processing your request.';
      suggestions = [
        'Try rephrasing your request',
        'Check if your API keys are configured correctly',
        'The service may be temporarily unavailable - please try again in a moment',
      ];
      
      // Extract more details from Dedalus errors
      if (error.message.includes('500')) {
        errorMessage = 'The AI service is experiencing technical difficulties.';
        suggestions = [
          'Please try again in a few moments',
          'If the problem persists, try simplifying your request',
        ];
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Authentication failed. Please check your API configuration.';
        suggestions = [
          'Verify your DEDALUS_API_KEY is set correctly',
          'Check that your API key has sufficient credits',
        ];
      }
    } else if (error.message?.includes('refused to execute')) {
      errorType = 'refusal_error';
      errorMessage = 'The AI assistant was unable to complete your request.';
      suggestions = [
        'Try rephrasing your request more clearly',
        'Break down complex requests into smaller steps',
        'Ensure you\'re requesting valid trading operations',
      ];
    } else if (error.message?.includes('not configured') || error.message?.includes('not available')) {
      errorType = 'configuration_error';
      errorMessage = 'The AI service is not properly configured.';
      suggestions = [
        'Set LLM_PROVIDER environment variable (dedalus, openai, or anthropic)',
        'Set the corresponding API key (DEDALUS_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY)',
      ];
    } else if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      errorType = 'timeout_error';
      errorMessage = 'The request took too long to process. LLM requests with web searches may take longer.';
      suggestions = [
        'The request exceeded the timeout limit (110 seconds). This often happens with complex queries or web searches.',
        'Try simplifying your request or breaking it into smaller parts',
        'If you\'re searching for information, try a more specific query',
        'Check your internet connection',
        'Try again in a moment - the service may be experiencing high load',
      ];
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorType = 'network_error';
      errorMessage = 'Unable to connect to the service.';
      suggestions = [
        'Check your internet connection',
        'Verify the backend server is running',
        'Check if there are any firewall restrictions',
      ];
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
      errorType,
      suggestions,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Message endpoint - accepts toolName and arguments, calls MCP directly (legacy endpoint)
router.post('/message', async (req: Request, res: Response) => {
  try {
    const { toolName, arguments: args } = req.body;

    if (!toolName) {
      return res.status(400).json({
        success: false,
        error: 'toolName is required. Use /chat/tools to see available tools.',
      });
    }

    const mcpClient = getMCPClient();
    await mcpClient.initialize();
    
    const result = await mcpClient.callTool({
      name: toolName,
      arguments: args || {},
    });
    
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error calling MCP tool:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to call MCP tool',
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
