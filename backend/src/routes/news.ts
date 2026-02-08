import { Router, Request, Response } from 'express';
import { getMCPClient } from '../mcp/client';
import { syncPortfolioToWatchlist } from '../services/watchlist-sync';

const router = Router();

// Get news articles
router.get('/', async (req: Request, res: Response) => {
  try {
    const { symbols, start, end, limit } = req.query;
    
    const mcpClient = getMCPClient();
    await mcpClient.initialize();
    
    const args: any = {};
    if (symbols) {
      // Parse comma-separated symbols
      const symbolList = typeof symbols === 'string' 
        ? symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
        : [];
      if (symbolList.length > 0) {
        args.symbols = symbolList;
      }
    }
    if (start && typeof start === 'string') {
      args.start = start;
    }
    if (end && typeof end === 'string') {
      args.end = end;
    }
    if (limit) {
      const limitNum = parseInt(limit as string, 10);
      if (!isNaN(limitNum)) {
        args.limit = limitNum;
      }
    }
    
    console.log(`[news] Fetching news with args:`, JSON.stringify(args));
    const result = await mcpClient.callTool({
      name: 'get_news',
      arguments: args,
    });
    
    console.log(`[news] Raw result length:`, result?.length || 0);
    console.log(`[news] Raw result preview:`, result?.substring(0, 200));
    
    // Parse JSON result from MCP tool
    let newsData;
    try {
      newsData = JSON.parse(result);
      console.log(`[news] Parsed successfully. Articles: ${newsData.articles?.length || 0}, Error: ${newsData.error || 'none'}`);
      
      // Check if there's an error in the response
      if (newsData.error) {
        console.error('[news] Error from news API:', newsData.error);
        return res.json({
          success: true,
          data: {
            articles: [],
            count: 0,
            start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            end_date: new Date().toISOString().split('T')[0],
            symbols: [],
            error: newsData.error,
          },
        });
      }
    } catch (e) {
      // If not JSON, return as error
      console.error('[news] Failed to parse news result:', result);
      return res.status(500).json({
        success: false,
        error: result || 'Failed to parse news data',
      });
    }
    
    res.json({ success: true, data: newsData });
  } catch (error: any) {
    console.error('Error fetching news:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch news',
    });
  }
});

// Get news for watchlist symbols (includes portfolio)
router.get('/watchlist', async (req: Request, res: Response) => {
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
    console.log(`[news/watchlist] Portfolio symbols: ${Array.from(portfolioSymbols).join(', ') || 'none'}`);
    
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
    
    // Merge portfolio and watchlist symbols
    const allSymbols = Array.from(new Set([...portfolioSymbols, ...watchlistSymbols]));
    console.log(`[news/watchlist] Total symbols for news: ${allSymbols.length} - ${allSymbols.join(', ') || 'none'}`);
    
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
          message: 'No symbols in portfolio or watchlist. Add symbols to your watchlist or open positions to see news.',
        },
      });
    }
    
    // Fetch news for all symbols
    const args: any = {
      symbols: allSymbols,
    };
    
    const { start, end, limit } = req.query;
    if (start && typeof start === 'string') {
      args.start = start;
    }
    if (end && typeof end === 'string') {
      args.end = end;
    }
    if (limit) {
      const limitNum = parseInt(limit as string, 10);
      if (!isNaN(limitNum)) {
        args.limit = limitNum;
      }
    } else {
      args.limit = 100; // Default limit
    }
    
    console.log(`[news/watchlist] Fetching news with args:`, JSON.stringify(args));
    const result = await mcpClient.callTool({
      name: 'get_news',
      arguments: args,
    });
    
    // Parse JSON result
    let newsData;
    try {
      newsData = JSON.parse(result);
      console.log(`[news/watchlist] Received ${newsData.articles?.length || 0} articles`);
    } catch (e) {
      console.error('[news/watchlist] Failed to parse news result:', result);
      return res.status(500).json({
        success: false,
        error: result || 'Failed to parse news data',
      });
    }
    
    // Ensure symbols are included in response
    if (!newsData.symbols) {
      newsData.symbols = allSymbols;
    }
    
    res.json({ success: true, data: newsData });
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
