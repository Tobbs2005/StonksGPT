import { Router, Request, Response } from 'express';
import { getMCPClient } from '../mcp/client';

const router = Router();

// Get all positions
router.get('/', async (req: Request, res: Response) => {
  try {
    const mcpClient = getMCPClient();
    await mcpClient.initialize();
    
    const result = await mcpClient.callTool({
      name: 'get_all_positions',
      arguments: {},
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error fetching positions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch positions',
    });
  }
});

// Get specific position
router.get('/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const mcpClient = getMCPClient();
    await mcpClient.initialize();
    
    const result = await mcpClient.callTool({
      name: 'get_open_position',
      arguments: { symbol },
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error(`Error fetching position for ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch position',
    });
  }
});

// Close position
router.post('/:symbol/close', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { qty, percentage } = req.body;
    
    const mcpClient = getMCPClient();
    await mcpClient.initialize();
    
    const args: any = { symbol };
    if (qty) args.qty = qty;
    if (percentage) args.percentage = percentage;
    
    const result = await mcpClient.callTool({
      name: 'close_position',
      arguments: args,
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error(`Error closing position ${req.params.symbol}:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to close position',
    });
  }
});

// Close all positions
router.post('/close-all', async (req: Request, res: Response) => {
  try {
    const { cancel_orders } = req.body;
    
    const mcpClient = getMCPClient();
    await mcpClient.initialize();
    
    const result = await mcpClient.callTool({
      name: 'close_all_positions',
      arguments: { cancel_orders: cancel_orders || false },
    });

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error closing all positions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to close all positions',
    });
  }
});

export default router;
