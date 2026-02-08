import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, ExternalLink, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StockChart, ChartData } from './StockChart';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NewsArticle, NewsResponse } from '@/lib/api';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  chartData?: ChartData;
  newsData?: NewsResponse;
}

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  chartLoadingIds?: Set<string>;
  onChartTimeframeChange?: (messageId: string, symbol: string, timeframe: string) => void;
}

export function MessageList({
  messages,
  isLoading = false,
  chartLoadingIds,
  onChartTimeframeChange,
}: MessageListProps) {
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);

  const formatDate = (dateStr: string) => {
    try {
      if (dateStr.length >= 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const date = new Date(`${year}-${month}-${day}`);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <ScrollArea className="h-full w-full">
      <div className="space-y-4 p-6">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[400px] text-muted-foreground">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[70%] rounded-lg px-4 py-3',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                    {message.content}
                  </p>
                  {message.chartData && (
                    <div className="mt-4">
                      <StockChart
                        chartData={message.chartData}
                        isLoading={chartLoadingIds?.has(message.id)}
                        onTimeframeChange={(timeframe) => {
                          onChartTimeframeChange?.(
                            message.id,
                            message.chartData?.metadata.symbol || '',
                            timeframe
                          );
                        }}
                      />
                    </div>
                  )}
                  {message.newsData && (
                    <div className="mt-4 space-y-3">
                      {[...(message.newsData.articles || [])]
                        .sort((a, b) => (b.published_date || '').localeCompare(a.published_date || ''))
                        .slice(0, 10)
                        .map((article, idx) => (
                        <button
                          key={`${article.url || article.title}-${idx}`}
                          type="button"
                          onClick={() => setActiveArticle(article)}
                          className="block w-full text-left"
                        >
                          <Card className="hover:bg-muted/50 transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold text-foreground">
                                    {article.title}
                                  </h3>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
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
                                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                      {article.summary}
                                    </p>
                                  )}
                                  {article.symbols && article.symbols.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                      {article.symbols.map((symbol) => (
                                        <Badge key={symbol} variant="outline" className="text-xs">
                                          {symbol}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-3">
                                    Tap to view details
                                  </p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </button>
                      ))}
                    </div>
                  )}
                  <p
                    className={cn(
                      'mt-1 text-xs',
                      message.role === 'user'
                        ? 'text-primary-foreground/70'
                        : 'text-muted-foreground'
                    )}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {message.role === 'user' && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-[70%] rounded-lg px-4 py-3 bg-muted text-foreground">
                  <p className="text-sm text-muted-foreground">Thinking…</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {activeArticle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
          onClick={() => setActiveArticle(null)}
        >
          <Card
            className="w-full max-w-2xl shadow-modal border-border/30"
            onClick={(event) => event.stopPropagation()}
          >
            <CardHeader className="space-y-2">
              <CardTitle className="text-lg">{activeArticle.title}</CardTitle>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{activeArticle.source}</span>
                <span>•</span>
                <span>{formatDate(activeArticle.published_date)}</span>
                {activeArticle.sentiment_label && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{activeArticle.sentiment_label}</span>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeArticle.summary && (
                <p className="text-sm text-muted-foreground">{activeArticle.summary}</p>
              )}
              {activeArticle.symbols && activeArticle.symbols.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeArticle.symbols.map((symbol) => (
                    <Badge key={symbol} variant="outline" className="text-xs">
                      {symbol}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={() => setActiveArticle(null)}>
                  Close
                </Button>
                {activeArticle.url && (
                  <Button asChild>
                    <a href={activeArticle.url} target="_blank" rel="noopener noreferrer">
                      Read article
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ScrollArea>
  );
}
