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

// LLM endpoint - processes natural language messages using Dedalus Labs MCP
router.post('/llm', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'message is required and must be a string',
      });
    }

    const llmService = getLLMService();
    
    if (!llmService.isAvailable()) {
      return res.status(503).json({
        success: false,
        error: 'LLM service is not configured. Please set LLM_PROVIDER and corresponding API key.',
      });
    }

    const result = await llmService.processMessage(message);
    
    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error processing message with LLM:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process message',
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
