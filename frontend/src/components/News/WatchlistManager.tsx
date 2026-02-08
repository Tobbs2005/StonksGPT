import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { newsApi, chatApi, positionsApi } from '@/lib/api';
import { X, Plus } from 'lucide-react';

export function WatchlistManager() {
  const [newSymbol, setNewSymbol] = useState('');
  const queryClient = useQueryClient();

  // Get portfolio positions
  const { data: positionsData } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.getAllPositions(),
    refetchInterval: 30000,
  });

  // Parse portfolio symbols
  const portfolioSymbols = useMemo(() => {
    if (!positionsData || positionsData.includes('No open positions')) {
      return [];
    }
    const symbols: string[] = [];
    const lines = positionsData.split('\n').map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
      const symbolMatch = line.match(/^Symbol:\s*(.+)$/i);
      if (symbolMatch) {
        const symbol = symbolMatch[1].trim().toUpperCase();
        if (symbol && !symbols.includes(symbol)) {
          symbols.push(symbol);
        }
      }
    }
    return symbols;
  }, [positionsData]);

  // Get watchlist symbols directly from watchlist
  const { data: watchlistsData } = useQuery({
    queryKey: ['watchlists'],
    queryFn: () => chatApi.callTool('get_watchlists', {}),
    refetchInterval: 60000,
  });

  // Get first watchlist symbols
  const { data: watchlistDetail } = useQuery({
    queryKey: ['watchlist-detail'],
    queryFn: async () => {
      if (!watchlistsData) return null;
      const idMatch = watchlistsData.match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        const watchlistId = idMatch[1];
        return await chatApi.callTool('get_watchlist_by_id', { watchlist_id: watchlistId });
      }
      return null;
    },
    enabled: !!watchlistsData,
    refetchInterval: 60000,
  });

  // Parse watchlist symbols
  const watchlistSymbols = useMemo(() => {
    if (!watchlistDetail) return [];
    const symbolsMatch = watchlistDetail.match(/Symbols:\s*(.+)$/im);
    if (symbolsMatch) {
      return symbolsMatch[1].split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    }
    return [];
  }, [watchlistDetail]);

  // Auto-sync watchlist when portfolio symbols change
  useEffect(() => {
    if (portfolioSymbols.length > 0) {
      const syncWatchlist = async () => {
        try {
          await newsApi.syncWatchlist();
          queryClient.invalidateQueries({ queryKey: ['news'] });
          queryClient.invalidateQueries({ queryKey: ['watchlists'] });
          queryClient.invalidateQueries({ queryKey: ['watchlist-detail'] });
        } catch (error) {
          console.error('Failed to auto-sync watchlist:', error);
        }
      };
      // Debounce sync to avoid too many calls
      const timeoutId = setTimeout(syncWatchlist, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [portfolioSymbols.length, queryClient]);

  const handleAddSymbol = async () => {
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol) return;

    try {
      // Get watchlists first
      const watchlistsResult = await chatApi.callTool('get_watchlists', {});
      
      // Find first watchlist ID
      const idMatch = watchlistsResult.match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        const watchlistId = idMatch[1];
        await chatApi.callTool('add_asset_to_watchlist_by_id', {
          watchlist_id: watchlistId,
          symbol: symbol,
        });
        queryClient.invalidateQueries({ queryKey: ['news'] });
        queryClient.invalidateQueries({ queryKey: ['watchlists'] });
        queryClient.invalidateQueries({ queryKey: ['watchlist-detail'] });
        setNewSymbol('');
      }
    } catch (error) {
      console.error('Failed to add symbol:', error);
    }
  };

  const handleRemoveSymbol = async (symbol: string) => {
    try {
      const watchlistsResult = await chatApi.callTool('get_watchlists', {});
      const idMatch = watchlistsResult.match(/ID:\s*([a-f0-9-]+)/i);
      if (idMatch) {
        const watchlistId = idMatch[1];
        await chatApi.callTool('remove_asset_from_watchlist_by_id', {
          watchlist_id: watchlistId,
          symbol: symbol,
        });
        queryClient.invalidateQueries({ queryKey: ['news'] });
        queryClient.invalidateQueries({ queryKey: ['watchlists'] });
        queryClient.invalidateQueries({ queryKey: ['watchlist-detail'] });
      }
    } catch (error) {
      console.error('Failed to remove symbol:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Watchlist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Add symbol"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddSymbol();
              }
            }}
            className="flex-1"
          />
          <Button onClick={handleAddSymbol} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
        
        {portfolioSymbols.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Portfolio Symbols</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {portfolioSymbols.map((symbol) => (
                <Badge key={symbol} variant="outline" className="text-xs">
                  {symbol}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {watchlistSymbols.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Watchlist Symbols</p>
            <div className="flex flex-wrap gap-2">
              {watchlistSymbols.map((symbol) => (
                <Badge 
                  key={symbol} 
                  variant={portfolioSymbols.includes(symbol) ? "default" : "secondary"} 
                  className="flex items-center gap-1"
                >
                  {symbol}
                  <button
                    onClick={() => handleRemoveSymbol(symbol)}
                    className="ml-1 hover:bg-secondary-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No symbols in watchlist</p>
        )}
      </CardContent>
    </Card>
  );
}
