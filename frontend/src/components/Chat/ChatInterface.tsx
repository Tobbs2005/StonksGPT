import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Phone, Play, Pause, Loader2 } from 'lucide-react';
import { MessageList, Message } from './MessageList';
import { MessageInput } from './MessageInput';
import { CallOverlay, TranscriptLine } from './CallOverlay';
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
  const [isCallOpen, setIsCallOpen] = useState(false);
  const [playbackState, setPlaybackState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const [rateLimitNotice, setRateLimitNotice] = useState<string | null>(null);
  const callStartRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const playbackAbortRef = useRef<AbortController | null>(null);
  const voiceEnabled = import.meta.env.VITE_VOICE_ENABLED !== 'false';

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
    setRateLimitNotice(null);
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

        if (error.response?.status === 429) {
          const retryAfterSeconds =
            typeof errorData.retryAfterSeconds === 'number'
              ? errorData.retryAfterSeconds
              : undefined;
          const mins =
            retryAfterSeconds !== undefined ? Math.max(1, Math.ceil(retryAfterSeconds / 60)) : undefined;
          setRateLimitNotice(
            mins
              ? `Rate limit reached (5 requests/hour). This protects our LLM keys. Try again in ~${mins} minute(s).`
              : 'Rate limit reached (5 requests/hour). This protects our LLM keys. Try again soon.',
          );
        }
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

  /* ── Playback: summarize session + TTS ── */
  const handlePlayback = useCallback(async () => {
    // If playing → pause
    if (playbackState === 'playing' && playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      setPlaybackState('paused');
      return;
    }
    // If paused → resume
    if (playbackState === 'paused' && playbackAudioRef.current) {
      playbackAudioRef.current.play();
      setPlaybackState('playing');
      return;
    }
    // If loading → ignore
    if (playbackState === 'loading') return;

    // Start fresh playback — include chat messages + call transcript lines
    const chatMessages: { role: string; content: string }[] = [];
    for (const m of messages) {
      if (m.isError) continue;
      // Include call transcript lines as individual messages
      if (m.transcriptData?.lines?.length) {
        for (const line of m.transcriptData.lines) {
          if (line.text?.trim()) {
            chatMessages.push({ role: line.role, content: line.text });
          }
        }
      } else if ((m.role === 'user' || m.role === 'assistant') && m.content) {
        chatMessages.push({ role: m.role, content: m.content });
      }
    }

    if (chatMessages.length === 0) return;

    setPlaybackState('loading');
    const ac = new AbortController();
    playbackAbortRef.current = ac;

    try {
      const summary = await chatApi.summarizeSession(chatMessages, ac.signal);
      if (ac.signal.aborted) return;

      const blob = await chatApi.getTtsAudio(summary, ac.signal);
      if (ac.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      playbackAudioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        playbackAudioRef.current = null;
        setPlaybackState('idle');
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        playbackAudioRef.current = null;
        setPlaybackState('idle');
      };

      await audio.play();
      setPlaybackState('playing');
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Playback error:', e);
      }
      setPlaybackState('idle');
    } finally {
      playbackAbortRef.current = null;
    }
  }, [messages, playbackState]);

  const stopPlayback = useCallback(() => {
    playbackAbortRef.current?.abort();
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause();
      playbackAudioRef.current = null;
    }
    setPlaybackState('idle');
  }, []);

  /* ── Call overlay handlers ── */
  const handleStartCall = useCallback(() => {
    stopPlayback();
    callStartRef.current = Date.now();
    setIsCallOpen(true);
  }, [stopPlayback]);

  const handleEndCall = useCallback(
    (transcript: TranscriptLine[]) => {
      setIsCallOpen(false);
      const durationSec = Math.floor((Date.now() - callStartRef.current) / 1000);

      if (transcript.length > 0) {
        const transcriptMsg: Message = {
          id: `call-${Date.now()}`,
          role: 'assistant',
          content: `Voice call ended (${Math.floor(durationSec / 60)}m ${durationSec % 60}s). Transcript is available below.`,
          timestamp: new Date(),
          transcriptData: {
            lines: transcript.map((l) => ({
              role: l.role,
              text: l.text,
              timestamp: l.timestamp.toISOString(),
            })),
            duration: durationSec,
            sessionId,
          },
        };
        setMessages((prev) => {
          const next = [...prev, transcriptMsg];
          persistMessages(next);
          return next;
        });
      }
    },
    [sessionId],
  );

  return (
    <>
    {/* Call overlay (portal-like, above everything) */}
    {voiceEnabled && (
      <CallOverlay isOpen={isCallOpen} onEndCall={handleEndCall} sessionId={sessionId} />
    )}

    <Card className="h-full w-full flex flex-col border-border/30 bg-card/95 rounded-2xl shadow-elevated overflow-hidden">
      <CardHeader className="border-b border-border/30 px-6 py-4 shrink-0 bg-card/60 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">StonksGPT</CardTitle>
            <p className="text-sm text-muted-foreground">Real-time trading assistant</p>
            {rateLimitNotice && (
              <p className="mt-1 text-xs text-muted-foreground">
                {rateLimitNotice}
              </p>
            )}
          </div>
          {sessionId && (
            <div className="flex items-center gap-2">
              {voiceEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full"
                  onClick={playbackState === 'idle' ? handlePlayback : playbackState === 'loading' ? undefined : handlePlayback}
                  disabled={isCallOpen || playbackState === 'loading' || messages.length === 0}
                >
                  {playbackState === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : playbackState === 'playing' ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {playbackState === 'loading'
                    ? 'Preparing...'
                    : playbackState === 'playing'
                      ? 'Pause'
                      : playbackState === 'paused'
                        ? 'Resume'
                        : 'Playback'}
                </Button>
              )}
              {voiceEnabled && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 rounded-full"
                  onClick={handleStartCall}
                  disabled={isCallOpen || playbackState === 'playing' || playbackState === 'loading'}
                >
                  <Phone className="h-4 w-4" />
                  Call
                </Button>
              )}
            </div>
          )}
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
        <MessageInput onSend={handleSend} disabled={isLoading || isCallOpen} />
      </div>
    </Card>
    </>
  );
}
