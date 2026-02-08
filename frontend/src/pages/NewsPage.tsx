import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { NewsList } from '@/components/News/NewsList';
import { NewsFilter } from '@/components/News/NewsFilter';
import { WatchlistManager } from '@/components/News/WatchlistManager';
import { newsApi, NewsArticle } from '@/lib/api';
import { RefreshCw, Newspaper, TrendingUp, Eye, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NewsMode = 'trending' | 'watchlist' | 'filter';

const MODE_CONFIG: { key: NewsMode; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'trending', label: 'Trending', icon: <TrendingUp className="h-3.5 w-3.5" />, description: 'Top market movers' },
  { key: 'watchlist', label: 'Watchlist', icon: <Eye className="h-3.5 w-3.5" />, description: 'Your tracked symbols' },
  { key: 'filter', label: 'Search', icon: <Filter className="h-3.5 w-3.5" />, description: 'Filter by symbol' },
];

export function NewsPage() {
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [newsMode, setNewsMode] = useState<NewsMode>('trending');

  useEffect(() => {
    if (newsMode === 'watchlist') {
      const syncWatchlist = async () => {
        try {
          await newsApi.syncWatchlist();
        } catch (error) {
          console.error('Failed to sync watchlist:', error);
        }
      };
      syncWatchlist();
    }
  }, [newsMode]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['news', newsMode, selectedSymbols.join(',')],
    queryFn: () => {
      if (newsMode === 'trending') {
        const defaultSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'V', 'JNJ'];
        return newsApi.getNews({ symbols: defaultSymbols, limit: 50 });
      } else if (newsMode === 'watchlist') {
        return newsApi.getWatchlistNews({ limit: 50 });
      } else {
        return newsApi.getNews({
          symbols: selectedSymbols.length > 0 ? selectedSymbols : undefined,
          limit: 50,
        });
      }
    },
    staleTime: 300000,
    gcTime: 600000,
    refetchInterval: 300000,
    refetchOnWindowFocus: false,
  });

  const availableSymbols = new Set<string>();
  if (data?.articles) {
    data.articles.forEach((article) => {
      article.symbols?.forEach((symbol) => availableSymbols.add(symbol));
    });
  }

  let filteredArticles: NewsArticle[] = [];
  if (data?.articles) {
    if (newsMode === 'trending' || newsMode === 'watchlist' || selectedSymbols.length === 0) {
      filteredArticles = data.articles;
    } else {
      filteredArticles = data.articles.filter((article) =>
        article.symbols?.some((symbol) => selectedSymbols.includes(symbol))
      );
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">
        {/* ── Header ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/10 flex items-center justify-center">
              <Newspaper className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Market News</h2>
              <p className="text-xs text-muted-foreground">
                Powered by MarketAux &middot; Real-time financial news
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-2 h-8 text-xs"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* ── Mode tabs ───────────────────────────────────────── */}
        <div className="flex items-center gap-1.5">
          {MODE_CONFIG.map((mode) => (
            <button
              key={mode.key}
              onClick={() => {
                setNewsMode(mode.key);
                if (mode.key !== 'filter') setSelectedSymbols([]);
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                newsMode === mode.key
                  ? 'bg-primary/10 text-primary border border-primary/20 shadow-sm shadow-primary/5'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
              )}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}

          {/* Article count */}
          {!isLoading && filteredArticles.length > 0 && (
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">
              {filteredArticles.length} article{filteredArticles.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* ── Content ─────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* Main area */}
          <div className="flex flex-col min-h-0">
            {/* Filter bar (only in filter mode) */}
            {newsMode === 'filter' && (
              <div className="mb-4 p-4 rounded-xl border border-border/40 bg-card/60 backdrop-blur-sm">
                <NewsFilter
                  selectedSymbols={selectedSymbols}
                  onSymbolsChange={setSelectedSymbols}
                  availableSymbols={Array.from(availableSymbols)}
                />
              </div>
            )}

            {/* Articles */}
            <div className="max-h-[calc(100vh-300px)] overflow-y-auto pr-1 -mr-1 scrollbar-thin">
              {error ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                    <Newspaper className="h-5 w-5 text-red-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">
                    Failed to load news
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {error instanceof Error ? error.message : 'An unexpected error occurred'}
                  </p>
                  {data?.error && (
                    <p className="text-xs text-muted-foreground mt-1">{data.error}</p>
                  )}
                </div>
              ) : !isLoading && filteredArticles.length === 0 && data?.error ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
                    <Newspaper className="h-5 w-5 text-amber-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">Configuration needed</p>
                  <p className="text-xs text-muted-foreground max-w-sm">{data.error}</p>
                  {data.error.includes('MARKETAUX_API_KEY') && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Please set <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-[11px]">MARKETAUX_API_KEY</code> in your .env file
                    </p>
                  )}
                </div>
              ) : newsMode === 'watchlist' && !isLoading && filteredArticles.length === 0 && data?.message ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                    <Eye className="h-5 w-5 text-blue-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No watchlist news</p>
                  <p className="text-xs text-muted-foreground max-w-sm">{data.message}</p>
                </div>
              ) : !isLoading && filteredArticles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                    <Newspaper className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">No articles found</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {newsMode === 'filter' && selectedSymbols.length > 0
                      ? `No news for ${selectedSymbols.join(', ')}. Try different symbols.`
                      : 'Try adjusting your filters or check back later.'}
                  </p>
                </div>
              ) : (
                <NewsList articles={filteredArticles} isLoading={isLoading} />
              )}
            </div>
          </div>

          {/* Sidebar — Watchlist */}
          <div className="flex flex-col">
            <WatchlistManager />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
