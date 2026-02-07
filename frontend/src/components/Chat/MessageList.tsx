import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';
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
    <ScrollArea className="h-full p-4">
      <div className="space-y-4 min-h-full">
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
                  'flex w-full',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-lg px-4 py-2 shadow-sm',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : message.isError
                      ? 'bg-destructive/10 border border-destructive/20 text-destructive'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {message.isError && (
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-xs font-semibold">Error</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-sm">{message.content}</div>
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
                  <div className="text-xs mt-1 opacity-70">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex w-full justify-start">
                <div className="max-w-[80%] rounded-lg px-4 py-2 shadow-sm bg-muted text-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-muted-foreground">AI is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ScrollArea>
  );
}
