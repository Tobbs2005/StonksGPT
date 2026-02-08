import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageList, Message } from './MessageList';
import { MessageInput } from './MessageInput';
import { chatApi } from '@/lib/api';

export function ChatInterface() {
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

  const handleSend = async (userMessage: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const result = await chatApi.sendMessage(userMessage);

      let chartData: any = undefined;
      let newsData: any = undefined;
      let content = result;

      const extractPayload = (type: 'chart' | 'news') => {
        const marker = `{"type":"${type}"`;
        const idx = content.lastIndexOf(marker);
        if (idx === -1) {
          return null;
        }
        const payloadText = content.slice(idx).trim();
        try {
          const parsed = JSON.parse(payloadText);
          if (parsed?.type === type) {
            content = content.slice(0, idx).trim();
            return parsed;
          }
        } catch (parseError) {
          return null;
        }
        return null;
      };

      const chartPayload = extractPayload('chart');
      if (chartPayload?.chartData) {
        chartData = chartPayload.chartData;
      }

      const newsPayload = extractPayload('news');
      if (newsPayload?.newsData) {
        newsData = newsPayload.newsData;
      }

      if (!content) {
        if (chartData?.metadata?.symbol) {
          content = `Here's the market data chart for ${chartData.metadata.symbol}:`;
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
        ...(chartData && { chartData }),
        ...(newsData && { newsData }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
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
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
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
      const chartData = await chatApi.getChartData(symbol, timeframe);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                chartData,
              }
            : msg
        )
      );
    } catch (error: any) {
      const errorContent = error.message || 'Failed to refresh chart data';
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `**Error**: ${errorContent}`,
          timestamp: new Date(),
          isError: true,
        },
      ]);
    } finally {
      setChartLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  return (
    <Card className="h-full w-full flex flex-col border-border/60 bg-card/95 rounded-2xl shadow-lg overflow-hidden">
      <CardHeader className="border-b border-border/40 px-6 py-4 shrink-0">
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
          />
          <div ref={messagesEndRef} />
        </ScrollArea>
      </CardContent>

      <div className="border-t border-border/40 bg-muted/20 shrink-0">
        <MessageInput onSend={handleSend} disabled={isLoading} />
      </div>
    </Card>
  );
}
