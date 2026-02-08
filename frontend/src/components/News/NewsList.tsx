import { NewsArticle } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';

interface NewsListProps {
  articles: NewsArticle[];
  isLoading?: boolean;
}

export function NewsList({ articles, isLoading }: NewsListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2 mb-4" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-5/6" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No news articles found.</p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateStr: string) => {
    try {
      // Format: YYYYMMDDTHHMMSS
      if (dateStr.length >= 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const date = new Date(`${year}-${month}-${day}`);
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {articles.map((article, idx) => (
        <Card key={idx} className="hover:bg-muted/50 transition-colors">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 mb-2">
                  <h3 className="font-semibold text-foreground flex-1">
                    {article.url ? (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors flex items-center gap-1"
                      >
                        {article.title}
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                    ) : (
                      article.title
                    )}
                  </h3>
                </div>
                
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  <span>{article.source}</span>
                  <span>•</span>
                  <span>{formatDate(article.published_date)}</span>
                  {article.sentiment_label && (
                    <>
                      <span>•</span>
                      <span className="capitalize">{article.sentiment_label}</span>
                    </>
                  )}
                </div>
                
                {article.summary && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {article.summary}
                  </p>
                )}
                
                {article.symbols && article.symbols.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {article.symbols.map((symbol) => (
                      <Badge key={symbol} variant="outline" className="text-xs">
                        {symbol}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
