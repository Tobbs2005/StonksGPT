import { Router, Request, Response } from 'express';
import { getMCPClient } from '../mcp/client';

const router = Router();

/**
 * GET /api/portfolio/history
 *
 * Fetches portfolio equity & P/L history from Alpaca via the
 * `get_portfolio_history` MCP tool.
 *
 * Query params (all optional):
 *   period    – window length: "1D","1W","1M","3M","6M","1A","all"
 *   timeframe – data resolution: "1Min","5Min","15Min","1H","1D"
 *   start     – ISO date/datetime
 *   end       – ISO date/datetime
 *
 * Returns JSON: { timestamp[], equity[], profit_loss[], profit_loss_pct[], base_value, timeframe }
 */
router.get('/history', async (req: Request, res: Response) => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        error: 'Request timeout fetching portfolio history',
      });
    }
  }, 30000);

  try {
    const mcpClient = getMCPClient();

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

    // Build arguments from query params — only include non-empty values
    const args: Record<string, string | boolean> = {};
    const { period, timeframe, start, end } = req.query;
    if (period && typeof period === 'string') args.period = period;
    if (timeframe && typeof timeframe === 'string') args.timeframe = timeframe;
    if (start && typeof start === 'string') args.start = start;
    if (end && typeof end === 'string') args.end = end;

    let result: string;
    try {
      result = await Promise.race([
        mcpClient.callTool({
          name: 'get_portfolio_history',
          arguments: args,
        }),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('Tool call timeout')), 15000)
        ),
      ]) as string;
    } catch (toolError: any) {
      clearTimeout(timeout);
      console.error('Error calling get_portfolio_history tool:', toolError);
      return res.status(500).json({
        success: false,
        error: `Failed to fetch portfolio history: ${toolError.message || 'Unknown error'}`,
      });
    }

    clearTimeout(timeout);
    res.json({ success: true, data: result });
  } catch (error: any) {
    clearTimeout(timeout);
    console.error('Unexpected error fetching portfolio history:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch portfolio history',
      });
    }
  }
});

export default router;
