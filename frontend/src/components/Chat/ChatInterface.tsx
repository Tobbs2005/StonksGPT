import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageList, Message } from './MessageList';
import { MessageInput } from './MessageInput';
import { chatApi } from '@/lib/api';
import { getChartDataCached, prefetchAdjacentTimeframes } from '@/lib/chartCache';
import {
  getSessionMessages,
  setSessionMessages,
  appendSessionMessage,
  serializeMessage,
  deserializeMessage,
} from '@/lib/sessionChatStorage';

const MAX_CONTEXT_MESSAGES = 3;

interface ChatInterfaceProps {
  /** When provided, chat is scoped to this session (per-session persistence). */
  sessionId?: string;
}

export function ChatInterface({ sessionId }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chartLoadingIds, setChartLoadingIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // ── Load messages on mount (per-session when sessionId is provided) ──
  useEffect(() => {
    if (!sessionId) return;
    try {
      const stored = getSessionMessages(sessionId);
      if (stored.length > 0) {
        setMessages(stored.map(deserializeMessage));
      }
    } catch (error) {
      console.warn('Failed to restore session chat history:', error);
    }
  }, [sessionId]);

  // ── Persist helper (writes to per-session storage) ──
  const persistMessages = (msgs: Message[]) => {
    if (!sessionId) return;
    try {
      setSessionMessages(sessionId, msgs.map(serializeMessage));
    } catch (error) {
      console.warn('Failed to persist session chat:', error);
    }
  };

  const handleSend = async (userMessage: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    const history = messages
      .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
      .slice(-MAX_CONTEXT_MESSAGES)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    setMessages((prev) => {
      const next = [...prev, userMsg];
      // Persist user message immediately
      if (sessionId) {
        appendSessionMessage(sessionId, serializeMessage(userMsg));
      }
      return next;
    });
    setIsLoading(true);

    try {
      const result = await chatApi.sendMessage(userMessage, history);

      let newsData: any = undefined;
      let content = result;

      // ── Extract ALL chart payloads (supports multi-ticker comparison) ──
      const chartMarker = '{"type":"chart"';
      const allCharts: any[] = [];
      let searchFrom = 0;
      // Collect every chart JSON blob from the response
      while (true) {
        const idx = content.indexOf(chartMarker, searchFrom);
        if (idx === -1) break;
        // Find the end of this JSON object by parsing from the marker
        const remaining = content.slice(idx);
        try {
          const parsed = JSON.parse(remaining.split('\n')[0].trim());
          if (parsed?.type === 'chart' && parsed.chartData) {
            allCharts.push(parsed.chartData);
          }
        } catch {
          // Try parsing the full remaining (in case no newline separator)
          try {
            const parsed = JSON.parse(remaining.trim());
            if (parsed?.type === 'chart' && parsed.chartData) {
              allCharts.push(parsed.chartData);
            }
          } catch {
            // skip malformed
          }
        }
        searchFrom = idx + 1;
      }
      // Strip all chart payloads from the text content
      if (allCharts.length > 0) {
        let cleaned = content;
        let stripIdx = cleaned.indexOf(chartMarker);
        if (stripIdx !== -1) {
          cleaned = cleaned.slice(0, stripIdx).trim();
        }
        content = cleaned;
      }

      // ── Extract news payload (single, last occurrence) ──
      const newsMarker = '{"type":"news"';
      const newsIdx = content.lastIndexOf(newsMarker);
      if (newsIdx !== -1) {
        const newsText = content.slice(newsIdx).trim();
        try {
          const parsed = JSON.parse(newsText);
          if (parsed?.type === 'news' && parsed.newsData) {
            newsData = parsed.newsData;
            content = content.slice(0, newsIdx).trim();
          }
        } catch {
          // ignore
        }
      }

      if (!content) {
        if (allCharts.length > 1) {
          const symbols = allCharts.map((c: any) => c.metadata?.symbol).filter(Boolean);
          content = `Here's the comparison for ${symbols.join(' vs ')}:`;
        } else if (allCharts.length === 1) {
          content = `Here's the market data chart for ${allCharts[0].metadata?.symbol || 'the stock'}:`;
        } else if (newsData?.symbols?.length) {
          content = `Here are the latest headlines for ${newsData.symbols.join(', ')}:`;
        } else if (newsData) {
          content = 'Here are the latest headlines:';
        }
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: content,
        timestamp: new Date(),
        // Single chart → chartData (backward compat), multi → charts array
        ...(allCharts.length === 1 && { chartData: allCharts[0] }),
        ...(allCharts.length > 1 && { charts: allCharts }),
        ...(newsData && { newsData }),
      };

      setMessages((prev) => {
        const next = [...prev, assistantMsg];
        persistMessages(next);
        return next;
      });
    } catch (error: any) {
      let errorContent = '';
      let suggestions: string[] = [];

      if (error.response?.data) {
        const errorData = error.response.data;
        errorContent = errorData.error || 'Failed to process request';
        suggestions = errorData.suggestions || [];
      } else if (error.request) {
        errorContent = 'Unable to connect to the server. Please check your connection.';
        suggestions = [
          'Check your internet connection',
          'Verify the backend server is running',
          'Try again in a moment',
        ];
      } else {
        errorContent = error.message || 'An unexpected error occurred';
      }

      let formattedError = `**Error**: ${errorContent}`;

      if (suggestions.length > 0) {
        formattedError += '\n\n**Suggestions:**\n';
        suggestions.forEach((suggestion, index) => {
          formattedError += `${index + 1}. ${suggestion}\n`;
        });
      }

      if (error.response?.data?.details) {
        formattedError += `\n\n_Details: ${error.response.data.details}_`;
      }

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: formattedError,
        timestamp: new Date(),
        isError: true,
      };

      setMessages((prev) => {
        const next = [...prev, errorMsg];
        persistMessages(next);
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Comparison: update ALL charts in a message to the new timeframe ──
  const handleComparisonTimeframeChange = async (messageId: string, symbols: string[], timeframe: string) => {
    if (!symbols.length) return;
    setChartLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });

    try {
      // Fetch all symbols in parallel using the cache
      const results = await Promise.allSettled(
        symbols.map((sym) => getChartDataCached(sym, timeframe)),
      );

      const updatedCharts: any[] = [];
      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'fulfilled') {
          updatedCharts.push(r.value);
        } else {
          // Keep the old chart data for this symbol (don't break the panel)
          updatedCharts.push(null);
        }
      }

      setMessages((prev) => {
        const next = prev.map((msg) => {
          if (msg.id !== messageId || !msg.charts) return msg;
          const merged = msg.charts.map((old, i) => updatedCharts[i] || old);
          return { ...msg, charts: merged };
        });
        persistMessages(next);
        return next;
      });

      // Prefetch adjacent timeframes for all symbols
      for (const sym of symbols) {
        prefetchAdjacentTimeframes(sym, timeframe);
      }
    } catch (error: any) {
      const errorContent = error.message || 'Failed to refresh chart data';
      setMessages((prev) => {
        const next = [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant' as const,
            content: `**Error**: ${errorContent}`,
            timestamp: new Date(),
            isError: true,
          },
        ];
        persistMessages(next);
        return next;
      });
    } finally {
      setChartLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  const handleChartTimeframeChange = async (messageId: string, symbol: string, timeframe: string) => {
    if (!symbol) {
      return;
    }
    setChartLoadingIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });

    try {
      // Use the client-side cache (deduplicates in-flight requests)
      const chartData = await getChartDataCached(symbol, timeframe);
      setMessages((prev) => {
        const next = prev.map((msg) =>
          msg.id === messageId ? { ...msg, chartData } : msg
        );
        persistMessages(next);
        return next;
      });

      // Prefetch adjacent timeframes on idle so the next switch is instant
      prefetchAdjacentTimeframes(symbol, timeframe);
    } catch (error: any) {
      const errorContent = error.message || 'Failed to refresh chart data';
      setMessages((prev) => {
        const next = [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant' as const,
            content: `**Error**: ${errorContent}`,
            timestamp: new Date(),
            isError: true,
          },
        ];
        persistMessages(next);
        return next;
      });
    } finally {
      setChartLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  return (
    <Card className="h-full w-full flex flex-col border-border/30 bg-card/95 rounded-2xl shadow-elevated overflow-hidden">
      <CardHeader className="border-b border-border/30 px-6 py-4 shrink-0 bg-card/60 backdrop-blur-xl">
        <div>
          <CardTitle className="text-lg">StonksGPT</CardTitle>
          <p className="text-sm text-muted-foreground">Real-time trading assistant</p>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0 overflow-hidden">
        <ScrollArea className="flex-1 w-full">
          <MessageList
            messages={messages}
            isLoading={isLoading}
            chartLoadingIds={chartLoadingIds}
            onChartTimeframeChange={handleChartTimeframeChange}
            onComparisonTimeframeChange={handleComparisonTimeframeChange}
          />
          <div ref={messagesEndRef} />
        </ScrollArea>
      </CardContent>

      <div className="border-t border-border/30 bg-muted/10 shrink-0">
        <MessageInput onSend={handleSend} disabled={isLoading} />
      </div>
    </Card>
  );
}
