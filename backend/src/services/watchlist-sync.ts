import { getMCPClient } from '../mcp/client';

export interface SyncResult {
  success: boolean;
  watchlistId?: string;
  watchlistName?: string;
  symbolsAdded: string[];
  totalSymbols: number;
  error?: string;
}

/**
 * Syncs portfolio positions to an Alpaca watchlist.
 * Finds or creates a "News Watchlist" and adds all portfolio symbols to it.
 */
export async function syncPortfolioToWatchlist(): Promise<SyncResult> {
  try {
    const mcpClient = getMCPClient();
    await mcpClient.initialize();
    
    // Get all positions
    const positionsResult = await mcpClient.callTool({
      name: 'get_all_positions',
      arguments: {},
    });
    
    // Parse positions to extract symbols
    const portfolioSymbols: string[] = [];
    if (positionsResult && !positionsResult.includes('No open positions') && !positionsResult.includes('No open positions found')) {
      const lines = positionsResult.split('\n').map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        // Match "Symbol: AAPL" format
        const symbolMatch = line.match(/^Symbol:\s*(.+)$/i);
        if (symbolMatch) {
          const symbol = symbolMatch[1].trim().toUpperCase();
          if (symbol && !portfolioSymbols.includes(symbol)) {
            portfolioSymbols.push(symbol);
          }
        }
      }
    }
    
    if (portfolioSymbols.length === 0) {
      return {
        success: true,
        symbolsAdded: [],
        totalSymbols: 0,
      };
    }
    
    // Get all watchlists
    const watchlistsResult = await mcpClient.callTool({
      name: 'get_watchlists',
      arguments: {},
    });
    
    // Find or use first watchlist (or create "News Watchlist")
    let watchlistId: string | null = null;
    let watchlistName = 'News Watchlist';
    
    if (watchlistsResult && watchlistsResult.includes('Watchlists:')) {
      // Try to find existing "News Watchlist" first
      const lines = watchlistsResult.split('\n');
      let currentName = '';
      for (let i = 0; i < lines.length; i++) {
        const nameMatch = lines[i].match(/^Name:\s*(.+)$/i);
        if (nameMatch) {
          currentName = nameMatch[1].trim();
        }
        const idMatch = lines[i].match(/^ID:\s*([a-f0-9-]+)$/i);
        if (idMatch) {
          if (currentName.toLowerCase().includes('news')) {
            watchlistId = idMatch[1];
            watchlistName = currentName;
            break;
          }
          // If no news watchlist found yet, use the first one we find
          if (!watchlistId) {
            watchlistId = idMatch[1];
            watchlistName = currentName || 'News Watchlist';
          }
        }
      }
    }
    
    // Create watchlist if none exists
    if (!watchlistId) {
      const createResult = await mcpClient.callTool({
        name: 'create_watchlist',
        arguments: {
          name: watchlistName,
          symbols: portfolioSymbols,
        },
      });
      
      // Re-fetch watchlists to get the new watchlist ID
      const updatedWatchlistsResult = await mcpClient.callTool({
        name: 'get_watchlists',
        arguments: {},
      });
      
      if (updatedWatchlistsResult && updatedWatchlistsResult.includes('Watchlists:')) {
        const lines = updatedWatchlistsResult.split('\n');
        let currentName = '';
        for (let i = 0; i < lines.length; i++) {
          const nameMatch = lines[i].match(/^Name:\s*(.+)$/i);
          if (nameMatch) {
            currentName = nameMatch[1].trim();
          }
          const idMatch = lines[i].match(/^ID:\s*([a-f0-9-]+)$/i);
          if (idMatch && currentName.toLowerCase().includes('news')) {
            watchlistId = idMatch[1];
            watchlistName = currentName;
            break;
          }
        }
        // If still not found, use first watchlist
        if (!watchlistId) {
          const firstIdMatch = updatedWatchlistsResult.match(/^ID:\s*([a-f0-9-]+)$/im);
          if (firstIdMatch) {
            watchlistId = firstIdMatch[1];
          }
        }
      }
      
      return {
        success: true,
        watchlistId: watchlistId || undefined,
        watchlistName,
        symbolsAdded: portfolioSymbols,
        totalSymbols: portfolioSymbols.length,
      };
    }
    
    // Get current watchlist symbols
    const watchlistDetail = await mcpClient.callTool({
      name: 'get_watchlist_by_id',
      arguments: { watchlist_id: watchlistId },
    });
    
    const existingSymbols = new Set<string>();
    const symbolsMatch = watchlistDetail.match(/Symbols:\s*(.+)$/im);
    if (symbolsMatch) {
      const symbols = symbolsMatch[1].split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      symbols.forEach(s => existingSymbols.add(s));
    }
    
    // Add portfolio symbols that aren't already in watchlist
    const symbolsToAdd: string[] = [];
    for (const symbol of portfolioSymbols) {
      if (!existingSymbols.has(symbol)) {
        symbolsToAdd.push(symbol);
        try {
          await mcpClient.callTool({
            name: 'add_asset_to_watchlist_by_id',
            arguments: {
              watchlist_id: watchlistId,
              symbol: symbol,
            },
          });
        } catch (error: any) {
          console.warn(`Failed to add ${symbol} to watchlist:`, error.message);
        }
      }
    }
    
    return {
      success: true,
      watchlistId,
      watchlistName,
      symbolsAdded: symbolsToAdd,
      totalSymbols: existingSymbols.size + symbolsToAdd.length,
    };
  } catch (error: any) {
    console.error('Error syncing portfolio to watchlist:', error);
    return {
      success: false,
      symbolsAdded: [],
      totalSymbols: 0,
      error: error.message || 'Failed to sync portfolio to watchlist',
    };
  }
}
