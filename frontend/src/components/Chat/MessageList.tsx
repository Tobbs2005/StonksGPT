import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StockChart, ChartData } from './StockChart';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
  chartData?: ChartData;
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
    </ScrollArea>
  );
}
