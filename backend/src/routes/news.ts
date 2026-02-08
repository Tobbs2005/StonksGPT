import { Router, Request, Response } from 'express';
import { getMCPClient } from '../mcp/client';
import { syncPortfolioToWatchlist } from '../services/watchlist-sync';
import { fetchMarketAuxNews } from '../services/marketaux';

const router = Router();

// Get news articles
const mergeNewsArticles = (primary: any, secondary: any) => {
  const seen = new Set<string>();
  const merged = [];
  for (const article of [...(primary || []), ...(secondary || [])]) {
    const key = article?.url || article?.title;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(article);
  }
  return merged;
};

const getCombinedNews = async ({
  symbols,
  start,
  end,
  limit,
  source,
  mcpClient,
}: {
  symbols: string[];
  start?: string;
  end?: string;
  limit?: number;
  source?: string;
  mcpClient: any;
}) => {
  const totalLimit = limit && limit > 0 ? limit : 10;
  const marketauxLimit = source === 'marketaux' ? Math.min(3, totalLimit) : Math.min(3, totalLimit);
  const oldLimit = source === 'marketaux' ? 0 : Math.max(0, totalLimit - marketauxLimit);

  const marketauxData = marketauxLimit > 0
    ? await fetchMarketAuxNews({ symbols, start, end, limit: marketauxLimit })
    : { articles: [], count: 0, start_date: start || '', end_date: end || '', symbols };

  let legacyData = { articles: [], count: 0, start_date: start || '', end_date: end || '', symbols };
  if (oldLimit > 0) {
    const args: any = { symbols, limit: oldLimit };
    if (start) args.start = start;
    if (end) args.end = end;
    const result = await mcpClient.callTool({
      name: 'get_news',
      arguments: args,
    });
    legacyData = JSON.parse(result);
  }

  const mergedArticles = mergeNewsArticles(marketauxData.articles, legacyData.articles)
    .sort((a: any, b: any) => String(b?.published_date || '').localeCompare(String(a?.published_date || '')))
    .slice(0, totalLimit);

  return {
    articles: mergedArticles,
    count: mergedArticles.length,
    start_date: marketauxData.start_date || legacyData.start_date || start || '',
    end_date: marketauxData.end_date || legacyData.end_date || end || '',
    symbols,
  };
};

router.get('/', async (req: Request, res: Response) => {
  try {
    const { symbols, start, end, limit, source } = req.query;
    
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
    
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : undefined;
    const combined = await getCombinedNews({
      symbols: args.symbols || [],
      start: typeof start === 'string' ? start : undefined,
      end: typeof end === 'string' ? end : undefined,
      limit: limitNum,
      source: typeof source === 'string' ? source : undefined,
      mcpClient,
    });
    res.json({ success: true, data: combined });
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
    
    const { start, end, limit, source } = req.query;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : undefined;
    const combined = await getCombinedNews({
      symbols: allSymbols,
      start: typeof start === 'string' ? start : undefined,
      end: typeof end === 'string' ? end : undefined,
      limit: limitNum,
      source: typeof source === 'string' ? source : undefined,
      mcpClient,
    });
    res.json({ success: true, data: combined });
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
    
    const { start, end, limit, source } = req.query;
    const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : undefined;
    const combined = await getCombinedNews({
      symbols: allSymbols,
      start: typeof start === 'string' ? start : undefined,
      end: typeof end === 'string' ? end : undefined,
      limit: limitNum,
      source: typeof source === 'string' ? source : undefined,
      mcpClient,
    });
    res.json({ success: true, data: combined });
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
