import { Router, Request, Response } from 'express';
import { getMCPClient } from '../mcp/client';
import { syncPortfolioToWatchlist } from '../services/watchlist-sync';
import { fetchMarketAuxNews } from '../services/marketaux';

const router = Router();

/**
 * Fetch news exclusively from MarketAux.
 * The legacy MCP get_news fallback has been removed so all
 * articles come from a single, consistent source.
 */
const getMarketAuxNewsDirect = async ({
  symbols,
  start,
  end,
  limit,
}: {
  symbols: string[];
  start?: string;
  end?: string;
  limit?: number;
}) => {
  const totalLimit = limit && limit > 0 ? limit : 50;
  const data = await fetchMarketAuxNews({ symbols, start, end, limit: totalLimit });

  return {
    articles: data.articles,
    count: data.articles.length,
    start_date: data.start_date || start || '',
    end_date: data.end_date || end || '',
    symbols,
    error: data.error,
  };
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const { symbols, start, end, limit } = req.query;

    const symbolList = typeof symbols === 'string'
      ? symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      : [];

    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : undefined;

    const data = await getMarketAuxNewsDirect({
      symbols: symbolList,
      start: typeof start === 'string' ? start : undefined,
      end: typeof end === 'string' ? end : undefined,
      limit: limitNum,
    });

    res.json({ success: true, data });
  } catch (error: any) {
    console.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch news',
    });
  }
});

// Get news for portfolio symbols only
router.get('/portfolio', async (req: Request, res: Response) => {
  try {
    const mcpClient = getMCPClient();
    await mcpClient.initialize();
    
    // Get all positions to extract portfolio symbols
    const positionsResult = await mcpClient.callTool({
      name: 'get_all_positions',
      arguments: {},
    });
    
    // Parse positions to extract symbols
    const portfolioSymbols = new Set<string>();
    if (positionsResult && !positionsResult.includes('No open positions') && !positionsResult.includes('No open positions found')) {
      const lines = positionsResult.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        const symbolMatch = line.match(/^Symbol:\s*(.+)$/i);
        if (symbolMatch) {
          portfolioSymbols.add(symbolMatch[1].trim().toUpperCase());
        }
      }
    }
    console.log(`[news/portfolio] Portfolio symbols: ${Array.from(portfolioSymbols).join(', ') || 'none'}`);
    
    const allSymbols = Array.from(portfolioSymbols);
    if (allSymbols.length === 0) {
      return res.json({
        success: true,
        data: {
          articles: [],
          count: 0,
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          symbols: [],
          message: 'No symbols in portfolio. Open positions to see news.',
        },
      });
    }
    
    const { start, end, limit } = req.query;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : undefined;
    const data = await getMarketAuxNewsDirect({
      symbols: allSymbols,
      start: typeof start === 'string' ? start : undefined,
      end: typeof end === 'string' ? end : undefined,
      limit: limitNum,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('[news/portfolio] Error fetching portfolio news:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch portfolio news',
    });
  }
});

// Get news for watchlist symbols
router.get('/watchlist', async (req: Request, res: Response) => {
  try {
    const mcpClient = getMCPClient();
    await mcpClient.initialize();
        
    // Get watchlists
    const watchlistsResult = await mcpClient.callTool({
      name: 'get_watchlists',
      arguments: {},
    });
    
    // Parse watchlists to get symbols - use first watchlist (same logic as sync)
    const watchlistSymbols = new Set<string>();
    let watchlistId: string | null = null;
    
    if (watchlistsResult && watchlistsResult.includes('Watchlists:')) {
      const lines = watchlistsResult.split('\n');
      let currentName = '';
      
      // Find first watchlist (prefer "News Watchlist" if exists)
      for (let i = 0; i < lines.length; i++) {
        const nameMatch = lines[i].match(/^Name:\s*(.+)$/i);
        if (nameMatch) {
          currentName = nameMatch[1].trim();
        }
        const idMatch = lines[i].match(/^ID:\s*([a-f0-9-]+)$/i);
        if (idMatch) {
          if (currentName.toLowerCase().includes('news')) {
            watchlistId = idMatch[1];
            break;
          }
          // If no news watchlist found yet, use the first one we find
          if (!watchlistId) {
            watchlistId = idMatch[1];
          }
        }
      }
      
      // Get symbols from the selected watchlist
      if (watchlistId) {
        try {
          const watchlistDetail = await mcpClient.callTool({
            name: 'get_watchlist_by_id',
            arguments: { watchlist_id: watchlistId },
          });
          
          console.log(`[news/watchlist] Watchlist ${watchlistId} detail:`, watchlistDetail.substring(0, 200));
          
          // Extract symbols from watchlist detail
          // Format: "Symbols: AAPL, MSFT, GOOGL" or "Symbols: " (empty)
          const symbolsMatch = watchlistDetail.match(/Symbols:\s*(.+)$/im);
          if (symbolsMatch && symbolsMatch[1].trim()) {
            const symbols = symbolsMatch[1].split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
            symbols.forEach(s => watchlistSymbols.add(s));
            console.log(`[news/watchlist] Found ${symbols.length} symbols in watchlist ${watchlistId}: ${symbols.join(', ')}`);
          } else {
            console.log(`[news/watchlist] Watchlist ${watchlistId} has no symbols`);
          }
        } catch (e: any) {
          console.warn(`[news/watchlist] Could not get watchlist ${watchlistId}:`, e.message);
        }
      }
    } else {
      console.log('[news/watchlist] No watchlists found or invalid format');
    }
    
    const allSymbols = Array.from(new Set([...watchlistSymbols]));
    console.log(`[news/watchlist] Total watchlist symbols for news: ${allSymbols.length} - ${allSymbols.join(', ') || 'none'}`);
    
    // If no symbols, return empty result with helpful message
    if (allSymbols.length === 0) {
      return res.json({
        success: true,
        data: {
          articles: [],
          count: 0,
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0],
          symbols: [],
          message: 'No symbols in watchlist. Add symbols to your watchlist to see news.',
        },
      });
    }
    
    const { start, end, limit } = req.query;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : undefined;
    const data = await getMarketAuxNewsDirect({
      symbols: allSymbols,
      start: typeof start === 'string' ? start : undefined,
      end: typeof end === 'string' ? end : undefined,
      limit: limitNum,
    });
    res.json({ success: true, data });
  } catch (error: any) {
    console.error('[news/watchlist] Error fetching watchlist news:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch watchlist news',
    });
  }
});

// Sync portfolio to watchlist
router.post('/sync-watchlist', async (req: Request, res: Response) => {
  try {
    const result = await syncPortfolioToWatchlist();
    res.json({ success: result.success, data: result });
  } catch (error: any) {
    console.error('Error syncing watchlist:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync watchlist',
    });
  }
});

export default router;
