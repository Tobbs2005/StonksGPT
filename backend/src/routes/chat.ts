import { Router, Request, Response } from 'express';
import { getMCPClient } from '../mcp/client';
import { getLLMService } from '../llm/service';
import { generateText } from '../llm/llm-provider';
import { MCPToolCall } from '../types';
import { createLlmRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Limit LLM-powered endpoints to protect API keys/costs (per IP)
const llmLimiter = createLlmRateLimiter({ maxPerHour: 5 });

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
router.post('/llm', llmLimiter, async (req: Request, res: Response) => {
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
    const { message, history } = req.body;

    if (!message || typeof message !== 'string') {
      clearTimeout(timeout);
      return res.status(400).json({
        success: false,
        error: 'message is required and must be a string',
      });
    }

    const sanitizedHistory = Array.isArray(history)
      ? history.filter((item: any) =>
          item &&
          (item.role === 'user' || item.role === 'assistant') &&
          typeof item.content === 'string'
        )
      : undefined;

    const llmService = getLLMService();
    
    if (!llmService.isAvailable()) {
      clearTimeout(timeout);
      return res.status(503).json({
        success: false,
        error: 'LLM service is not configured. Please set LLM_PROVIDER and corresponding API key.',
      });
    }

    // Wrap LLM processing in a timeout promise
    const processPromise = llmService.processMessage(message, sanitizedHistory);
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

// Convert raw AI response to conversational, speakable text for TTS
const TO_SPEAKABLE_SYSTEM = `You convert AI assistant output into a brief, natural spoken summary for text-to-speech. The user will hear this aloud.

Rules:
- Output ONLY the spoken version, nothing else. No quotes, no preamble.
- Use conversational, natural English.
- No JSON, no markdown, no syntax, no raw data, no code.
- If there are numbers or statistics, round them and say them conversationally (e.g. "up about 5 percent" not "4.73%").
- If the response contains chart/stock data, summarize the key takeaway in 1-3 sentences (e.g. "Apple stock has been looking good recently with some increase in price over the past week").
- Keep it concise: typically 1-4 sentences.
- Sound like a helpful friend, not a data report.
- If the content is already conversational and short, you may return it with minimal or no changes.`;

router.post('/to-speakable', llmLimiter, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text is required' });
    }
    const { text: speakable } = await generateText(text, { systemPrompt: TO_SPEAKABLE_SYSTEM });
    res.json({ success: true, data: speakable.trim() });
  } catch (error: any) {
    console.error('to-speakable error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to convert to speakable' });
  }
});

// Summarize a full session chat into a conversational spoken recap
const SUMMARIZE_SESSION_SYSTEM = `You are a friendly financial assistant. You will receive the full chat transcript of a trading session between a user and an AI.

Your job: produce a spoken summary of the entire session as if you're giving a quick recap to the user. This will be read aloud via text-to-speech.

Rules:
- Output ONLY the spoken summary. No quotes, no preamble, no markdown.
- Use natural, conversational English as if talking to a friend.
- Cover the key topics discussed: which stocks/companies, any trades, key insights, price movements, recommendations.
- Round numbers conversationally (e.g. "about two hundred dollars" not "$198.47").
- Keep it concise: aim for 30–90 seconds when spoken (roughly 4–12 sentences).
- Start with something like "Here's a quick recap of our session..." or similar.
- End with a brief forward-looking note if relevant (e.g. "You might want to keep an eye on...").
- If the conversation was short or trivial, keep the summary proportionally brief.`;

router.post('/summarize-session', llmLimiter, async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, error: 'messages array is required' });
    }
    const transcript = messages
      .filter((m: any) => m.role && m.content)
      .map((m: any) => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n');
    if (!transcript.trim()) {
      return res.status(400).json({ success: false, error: 'No valid messages to summarize' });
    }
    const { text: summary } = await generateText(transcript, { systemPrompt: SUMMARIZE_SESSION_SYSTEM });
    res.json({ success: true, data: summary.trim() });
  } catch (error: any) {
    console.error('summarize-session error:', error);
    res.status(500).json({ success: false, error: error?.message || 'Failed to summarize session' });
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
