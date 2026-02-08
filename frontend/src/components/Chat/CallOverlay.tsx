import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { chatApi } from '@/lib/api';
import type { ChatHistoryMessage } from '@/lib/api';

export interface TranscriptLine {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface CallOverlayProps {
  isOpen: boolean;
  onEndCall: (transcript: TranscriptLine[]) => void;
  sessionId?: string;
}

type CallPhase = 'idle' | 'speaking' | 'listening' | 'processing';

const GREETING = 'How are you doing today—what companies do you want to look at for today?';
const TARGET_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 1600; // ~100ms at 16kHz
const POST_TTS_DELAY_MS = 350;

function resampleTo16k(
  input: Float32Array,
  inputSampleRate: number,
  output: Int16Array,
): number {
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  let outIdx = 0;
  for (let i = 0; i < output.length && outIdx * ratio < input.length; i++) {
    const srcIdx = i * ratio;
    const i0 = Math.floor(srcIdx);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIdx - i0;
    const sample = input[i0] * (1 - frac) + input[i1] * frac;
    const s16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    output[outIdx++] = s16;
  }
  return outIdx;
}

function pcmToBase64(chunk: number[]): string {
  const bytes = new Uint8Array(chunk.length * 2);
  const view = new DataView(bytes.buffer);
  chunk.forEach((s, i) => view.setInt16(i * 2, s, true));
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += 2048) {
    const sub = bytes.subarray(i, Math.min(i + 2048, bytes.length));
    parts.push(String.fromCharCode(...Array.from(sub)));
  }
  return btoa(parts.join(''));
}

export function CallOverlay({ isOpen, onEndCall, sessionId }: CallOverlayProps) {
  const [phase, setPhase] = useState<CallPhase>('idle');
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [partialText, setPartialText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Refs ──
  const callRunIdRef = useRef(0);
  const startTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sttWsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pcmBufferRef = useRef<number[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const mutedRef = useRef(false);
  const phaseRef = useRef<CallPhase>('idle');
  const processUserTurnRef = useRef<(text: string, runId: number) => void>(() => {});

  // Keep refs in sync with state
  transcriptRef.current = transcript;
  mutedRef.current = muted;
  phaseRef.current = phase;

  const getRunId = () => callRunIdRef.current;
  const isCurrentRun = (id: number) => id === getRunId();

  const addLine = useCallback((role: 'user' | 'assistant', text: string) => {
    if (!text.trim()) return;
    setTranscript((prev) => [...prev, { role, text: text.trim(), timestamp: new Date() }]);
  }, []);

  // ── Stop mic capture ──
  const stopMic = useCallback(() => {
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (sourceRef.current) {
      try { sourceRef.current.disconnect(); } catch {}
      sourceRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    pcmBufferRef.current = [];
  }, []);

  // ── Close STT WebSocket ──
  const closeSttWs = useCallback(() => {
    const ws = sttWsRef.current;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
      sttWsRef.current = null;
    }
  }, []);

  // ── Open STT WebSocket (returns a promise that resolves when connected) ──
  const openSttWs = useCallback(
    (runId: number): Promise<WebSocket> => {
      return new Promise((resolve, reject) => {
        // If already open, reuse
        if (sttWsRef.current && sttWsRef.current.readyState === WebSocket.OPEN) {
          resolve(sttWsRef.current);
          return;
        }
        // Close stale
        closeSttWs();

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/ws/stt${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`;
        const ws = new WebSocket(wsUrl);
        sttWsRef.current = ws;

        ws.onopen = () => {
          if (!isCurrentRun(runId)) { ws.close(); reject(new Error('stale')); return; }
          resolve(ws);
        };
        ws.onmessage = (event) => {
          if (!isCurrentRun(runId)) return;
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'partial') {
              setPartialText(msg.text || '');
            } else if (msg.type === 'final' && msg.text?.trim()) {
              setPartialText('');
              processUserTurnRef.current(msg.text.trim(), runId);
            } else if (msg.type === 'error') {
              setError(msg.error || 'STT error');
            }
          } catch {}
        };
        ws.onerror = () => {
          setError('STT connection error');
          reject(new Error('ws error'));
        };
        ws.onclose = () => {
          if (sttWsRef.current === ws) sttWsRef.current = null;
        };
      });
    },
    [sessionId, closeSttWs],
  );

  // ── Play TTS ──
  const playTts = useCallback(
    async (text: string, runId: number): Promise<void> => {
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const blob = await chatApi.getTtsAudio(text, ac.signal);
        if (!isCurrentRun(runId) || ac.signal.aborted) return;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(); };
          audio.onerror = () => reject(new Error('TTS playback failed'));
          audio.play().catch(reject);
        });
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (isCurrentRun(runId)) {
          setError(e?.message || 'TTS failed');
          addLine('assistant', `[Error: ${e?.message || 'Could not play audio'}]`);
        }
      } finally {
        abortRef.current = null;
      }
    },
    [addLine],
  );

  // ── Start mic capture + stream to STT WS ──
  const startMic = useCallback(
    async (runId: number) => {
      if (mutedRef.current) return;

      // Ensure STT WS is open (reconnect if needed)
      let ws: WebSocket;
      try {
        ws = await openSttWs(runId);
      } catch {
        return; // stale or failed
      }
      if (!isCurrentRun(runId) || mutedRef.current) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isCurrentRun(runId)) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        if (ctx.state === 'suspended') await ctx.resume();

        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        const inputRate = ctx.sampleRate;
        const outputSize = Math.ceil((4096 * TARGET_SAMPLE_RATE) / inputRate) + 10;
        const outputBuf = new Int16Array(outputSize);

        processor.onaudioprocess = (e) => {
          // Write to output so browser keeps firing the callback
          const input = e.inputBuffer.getChannelData(0);
          e.outputBuffer.getChannelData(0).set(input);

          // Check refs (not stale state) for muted / WS status
          if (mutedRef.current) return;
          const currentWs = sttWsRef.current;
          if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;

          const n = resampleTo16k(input, inputRate, outputBuf);
          for (let i = 0; i < n; i++) pcmBufferRef.current.push(outputBuf[i]);
          while (pcmBufferRef.current.length >= CHUNK_SAMPLES) {
            const chunk = pcmBufferRef.current.splice(0, CHUNK_SAMPLES);
            const base64 = pcmToBase64(chunk);
            try {
              currentWs.send(JSON.stringify({ type: 'audio', base64, commit: false }));
            } catch { break; }
          }
        };

        const gain = ctx.createGain();
        gain.gain.value = 0; // silence output to speakers
        source.connect(processor);
        processor.connect(gain);
        gain.connect(ctx.destination);
      } catch (e: any) {
        if (isCurrentRun(runId)) {
          setError(e?.message || 'Microphone access denied');
        }
      }
    },
    [openSttWs],
  );

  // ── Process a committed user transcript ──
  const processUserTurn = useCallback(
    async (userText: string, runId: number) => {
      stopMic();
      closeSttWs(); // close STT WS while processing (will reopen on next listen)
      addLine('user', userText);
      setPhase('processing');
      setPartialText('');

      const history: ChatHistoryMessage[] = transcriptRef.current
        .map((l) => ({ role: l.role, content: l.text }))
        .slice(-6);

      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const aiText = await chatApi.sendMessage(userText, history.length > 0 ? history : undefined);
        if (!isCurrentRun(runId) || ac.signal.aborted) return;

        setPhase('speaking');
        const speakAc = new AbortController();
        abortRef.current = speakAc;

        let textToSpeak = aiText;
        try {
          textToSpeak = await chatApi.toSpeakable(aiText, speakAc.signal);
          if (!textToSpeak?.trim()) textToSpeak = aiText;
        } catch (e: any) {
          if (e?.name === 'AbortError') return;
          textToSpeak = aiText;
        }
        if (!isCurrentRun(runId) || speakAc.signal.aborted) return;

        addLine('assistant', textToSpeak);
        await playTts(textToSpeak, runId);
        if (!isCurrentRun(runId)) return;

        await new Promise((r) => setTimeout(r, POST_TTS_DELAY_MS));
        if (!isCurrentRun(runId)) return;
        setPhase('listening');
      } catch (e: any) {
        if (e?.name === 'AbortError') return;
        if (isCurrentRun(runId)) {
          setError(e?.message || 'Failed to get response');
          addLine('assistant', `[Error: ${e?.message || 'Could not reach AI'}]`);
          setPhase('listening');
        }
      } finally {
        abortRef.current = null;
      }
    },
    [addLine, playTts, stopMic, closeSttWs],
  );

  // Keep ref in sync so WS onmessage can call the latest version
  processUserTurnRef.current = processUserTurn;

  // ── Auto-scroll transcript ──
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, partialText]);

  // ── Call lifecycle: open on mount, cleanup on unmount ──
  useEffect(() => {
    if (!isOpen) return;
    const runId = ++callRunIdRef.current;
    setPhase('idle');
    setMuted(false);
    setElapsed(0);
    setTranscript([]);
    setPartialText('');
    setError(null);
    startTimeRef.current = Date.now();
    stopMic();
    closeSttWs();

    // Open initial STT WS, play greeting, then enter listening
    openSttWs(runId)
      .then(() => {
        if (!isCurrentRun(runId)) return;
        setPhase('speaking');
        addLine('assistant', GREETING);
        return playTts(GREETING, runId);
      })
      .then(() => {
        if (!isCurrentRun(runId)) return;
        return new Promise((r) => setTimeout(r, POST_TTS_DELAY_MS));
      })
      .then(() => {
        if (!isCurrentRun(runId)) return;
        setPhase('listening');
      })
      .catch(() => {
        if (isCurrentRun(runId)) setError('Failed to connect');
      });

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      callRunIdRef.current++;
      clearInterval(timerRef.current);
      abortRef.current?.abort();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      stopMic();
      closeSttWs();
    };
  }, [isOpen, sessionId]);

  // ── React to phase / mute changes: start or stop mic ──
  useEffect(() => {
    if (!isOpen) return;
    if (muted) {
      stopMic();
    } else if (phase === 'listening') {
      startMic(getRunId());
    }
  }, [muted, phase, isOpen, stopMic, startMic]);

  const handleToggleMute = () => setMuted((p) => !p);

  const handleEnd = () => {
    callRunIdRef.current++;
    abortRef.current?.abort();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    stopMic();
    closeSttWs();
    clearInterval(timerRef.current);
    onEndCall(transcript);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const phaseLabel =
    phase === 'listening'
      ? 'Listening...'
      : phase === 'processing'
        ? 'Thinking...'
        : phase === 'speaking'
          ? 'Speaking...'
          : 'Connecting...';

  return (
    <div className="fixed inset-0 z-[100] flex bg-background/95 backdrop-blur-md">
      <div className="w-80 shrink-0 flex flex-col border-r border-border/30 bg-card/60 backdrop-blur-xl">
        <div className="shrink-0 px-4 py-3 border-b border-border/30">
          <p className="text-sm font-semibold text-foreground">Live Transcript</p>
          <p className="text-xs text-muted-foreground tabular-nums">{formatTime(elapsed)}</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {transcript.length === 0 && !partialText ? (
              <p className="text-xs text-muted-foreground italic">
                Conversation will appear here once you start speaking...
              </p>
            ) : (
              <>
                {transcript.map((line, i) => (
                  <div key={i} className="space-y-0.5">
                    <p className="text-[10px] text-muted-foreground/60 tabular-nums">
                      {line.timestamp.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                    <p
                      className={`text-sm leading-relaxed ${
                        line.role === 'user' ? 'text-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      <span className="font-semibold">{line.role === 'user' ? 'You' : 'AI'}:</span>{' '}
                      {line.text}
                    </p>
                  </div>
                ))}
                {partialText && (
                  <p className="text-sm text-muted-foreground/80 italic">{partialText}</p>
                )}
                <div ref={transcriptEndRef} />
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative">
        <div className="absolute top-8 flex flex-col items-center gap-1">
          <p className="text-sm font-medium text-foreground">StonksGPT Voice</p>
        </div>
        <p className="mb-8 text-sm font-medium text-muted-foreground tracking-wide">
          {phaseLabel}
        </p>
        {error && (
          <p className="mb-4 text-sm text-destructive max-w-md text-center">{error}</p>
        )}

        <div className="relative flex items-center justify-center w-64 h-64 pointer-events-none">
          <div className="call-ring-1 absolute inset-0 rounded-full border-2 border-primary/40" />
          <div className="call-ring-2 absolute inset-0 rounded-full border border-primary/25" />
          <div className="call-ring-3 absolute inset-0 rounded-full border border-primary/15" />
          <div
            className={`call-blob relative w-40 h-40 flex items-center justify-center
              bg-gradient-to-br from-primary via-primary/80 to-emerald-500
              shadow-[0_0_80px_20px_hsl(var(--primary)/0.35)]
              transition-all duration-700 ${
                phase === 'speaking'
                  ? 'scale-110'
                  : phase === 'listening'
                    ? 'scale-100'
                    : 'scale-95 opacity-80'
              }`}
          >
            <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-tr from-white/10 to-transparent" />
            <span className="text-5xl select-none">
              {phase === 'listening' ? '🎧' : phase === 'speaking' ? '🔊' : '⏳'}
            </span>
          </div>
        </div>

        <div className="mt-16 flex items-center gap-6">
          <button
            type="button"
            onClick={handleToggleMute}
            className={`rounded-full h-16 w-16 flex items-center justify-center border transition-colors
              ${
                muted
                  ? 'bg-destructive/10 border-destructive/40 text-destructive hover:bg-destructive/20'
                  : 'bg-card/80 border-border/60 text-foreground hover:bg-card'
              }
              shadow-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40`}
            title={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>

          <Button
            variant="destructive"
            size="lg"
            onClick={handleEnd}
            className="rounded-full h-16 w-16 p-0 shadow-elevated"
            title="End call"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>

        {muted && (
          <p className="mt-4 text-xs text-destructive font-medium">Microphone muted</p>
        )}
      </div>
    </div>
  );
}
