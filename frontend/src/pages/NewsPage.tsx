import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageShell } from '@/components/layout/PageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { NewsList } from '@/components/News/NewsList';
import { NewsFilter } from '@/components/News/NewsFilter';
import { WatchlistManager } from '@/components/News/WatchlistManager';
import { newsApi, NewsArticle } from '@/lib/api';
import { getAuth, logout } from '@/lib/auth';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type NewsMode = 'trending' | 'watchlist' | 'filter';

export function NewsPage() {
  const navigate = useNavigate();
  const auth = getAuth();
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [newsMode, setNewsMode] = useState<NewsMode>('trending');

  // Sync watchlist on mount and when switching to watchlist mode
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

  // Fetch news
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['news', newsMode, selectedSymbols.join(',')],
    queryFn: () => {
      if (newsMode === 'trending') {
        // Trending: use popular stocks for general market news
        const defaultSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'V', 'JNJ'];
        return newsApi.getNews({ symbols: defaultSymbols, limit: 100 });
      } else if (newsMode === 'watchlist') {
        return newsApi.getWatchlistNews({ limit: 100 });
      } else {
        // Filter mode
        return newsApi.getNews({
          symbols: selectedSymbols.length > 0 ? selectedSymbols : undefined,
          limit: 100,
        });
      }
    },
    staleTime: 300000, // Cache for 5 minutes to reduce repeated calls
    cacheTime: 600000,
    refetchInterval: 300000, // Auto-refresh every 5 minutes
    refetchOnWindowFocus: false,
  });

  // Extract available symbols from news data for autocomplete
  const availableSymbols = new Set<string>();
  if (data?.articles) {
    data.articles.forEach((article) => {
      article.symbols?.forEach((symbol) => availableSymbols.add(symbol));
    });
  }

  // Filter articles by selected symbols if in filter mode
  let filteredArticles: NewsArticle[] = [];
  if (data?.articles) {
    if (newsMode === 'trending' || newsMode === 'watchlist' || selectedSymbols.length === 0) {
      filteredArticles = data.articles;
    } else {
      // Filter mode: only show articles matching selected symbols
      filteredArticles = data.articles.filter((article) =>
        article.symbols?.some((symbol) => selectedSymbols.includes(symbol))
      );
    }
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <PageShell
      userName={auth?.username || 'Trader'}
      onGoHome={() => navigate('/app')}
      onLogout={handleLogout}
    >
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Market News</h2>
            <p className="text-sm text-muted-foreground">
              Stay updated with the latest news for your portfolio and watchlist
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* News List */}
          <div className="flex flex-col">
            <Card className="flex flex-col max-h-[calc(100vh-250px)]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>News Articles</CardTitle>
                  <div className="inline-flex rounded-md border border-input bg-muted/40 p-1">
                    <Button
                      variant={newsMode === 'trending' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-sm px-3"
                      onClick={() => {
                        setNewsMode('trending');
                        setSelectedSymbols([]);
                      }}
                    >
                      Trending
                    </Button>
                    <Button
                      variant={newsMode === 'watchlist' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-sm px-3"
                      onClick={() => {
                        setNewsMode('watchlist');
                        setSelectedSymbols([]);
                      }}
                    >
                      Watchlist
                    </Button>
                    <Button
                      variant={newsMode === 'filter' ? 'secondary' : 'ghost'}
                      size="sm"
                      className="rounded-sm px-3"
                      onClick={() => setNewsMode('filter')}
                    >
                      Filter
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {newsMode === 'filter' && (
                  <div className="mb-4">
                    <NewsFilter
                      selectedSymbols={selectedSymbols}
                      onSymbolsChange={setSelectedSymbols}
                      availableSymbols={Array.from(availableSymbols)}
                    />
                  </div>
                )}
                
                {error ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-destructive mb-2">
                      {error instanceof Error ? error.message : 'Failed to load news'}
                    </p>
                    {data?.error && (
                      <p className="text-xs text-muted-foreground">{data.error}</p>
                    )}
                  </div>
                ) : !isLoading && filteredArticles.length === 0 && data?.error ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-destructive mb-2">Error loading news</p>
                    <p className="text-xs text-muted-foreground">{data.error}</p>
                    {data.error.includes('ALPHA_VANTAGE_API_KEY') && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Please set ALPHA_VANTAGE_API_KEY in your .env file
                      </p>
                    )}
                  </div>
                ) : newsMode === 'watchlist' && !isLoading && filteredArticles.length === 0 && data?.message ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">{data.message}</p>
                  </div>
                ) : !isLoading && filteredArticles.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-sm text-muted-foreground">No news articles found.</p>
                    {data && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Searched {data.symbols?.length || 0} symbol(s) from {data.start_date} to {data.end_date}
                      </p>
                    )}
                  </div>
                ) : (
                  <NewsList articles={filteredArticles} isLoading={isLoading} />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Watchlist Sidebar */}
          <div className="flex flex-col">
            <WatchlistManager />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
