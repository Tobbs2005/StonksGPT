import { Router, Request, Response } from 'express';
import { getMCPClient } from '../mcp/client';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const mcpClient = getMCPClient();
    await mcpClient.initialize();
    
    const result = await mcpClient.callTool({
      name: 'get_account_info',
      arguments: {},
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching account info:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch account info',
    });
  }
});

export default router;
