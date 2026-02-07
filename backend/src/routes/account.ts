import { Router, Request, Response } from 'express';
import { getMCPClient } from '../mcp/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  // Set a timeout for the entire request
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        error: 'Request timeout - MCP client initialization or tool call took too long',
      });
    }
  }, 30000); // 30 second timeout

  try {
    const mcpClient = getMCPClient();
    
    // Initialize with timeout protection
    try {
      await Promise.race([
        mcpClient.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('MCP client initialization timeout')), 15000)
        ),
      ]);
    } catch (initError: any) {
      clearTimeout(timeout);
      console.error('Error initializing MCP client:', initError);
      return res.status(500).json({
        success: false,
        error: `Failed to initialize MCP client: ${initError.message || 'Unknown error'}`,
      });
    }
    
    // Call tool with timeout protection
    let result: string;
    try {
      result = await Promise.race([
        mcpClient.callTool({
          name: 'get_account_info',
          arguments: {},
        }),
        new Promise<string>((_, reject) => 
          setTimeout(() => reject(new Error('Tool call timeout')), 15000)
        ),
      ]) as string;
    } catch (toolError: any) {
      clearTimeout(timeout);
      console.error('Error calling get_account_info tool:', toolError);
      return res.status(500).json({
        success: false,
        error: `Failed to fetch account info: ${toolError.message || 'Unknown error'}`,
      });
    }

    clearTimeout(timeout);
    res.json({ success: true, data: result });
  } catch (error: any) {
    clearTimeout(timeout);
    console.error('Unexpected error fetching account info:', error);
    
    // Ensure response hasn't been sent
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch account info',
      });
    }
  }
});

export default router;
