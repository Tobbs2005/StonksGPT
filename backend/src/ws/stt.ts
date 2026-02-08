/**
 * WebSocket bridge: Frontend <-> Backend <-> ElevenLabs Realtime STT
 *
 * Frontend sends: { type: "audio", base64: "..." } or { type: "audio", base64: "...", commit: true }
 * Backend forwards to ElevenLabs as input_audio_chunk.
 * Backend relays: partial_transcript, committed_transcript, errors to frontend.
 */

import { WebSocket } from 'ws';
import * as WebSocketModule from 'ws';

const ELEVENLABS_STT_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
const MODEL_ID = 'scribe_v2_realtime';

export function handleSttWebSocket(clientWs: import('ws').WebSocket, _url: string): void {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    try {
      clientWs.send(JSON.stringify({ type: 'error', error: 'ELEVENLABS_API_KEY is not configured' }));
    } catch {}
    clientWs.close();
    return;
  }

  const params = new URLSearchParams({
    model_id: MODEL_ID,
    audio_format: 'pcm_16000',
    commit_strategy: 'vad',
    vad_silence_threshold_secs: '1.5',
    vad_threshold: '0.4',
    include_timestamps: 'false',
  });

  const elevenLabsUrl = `${ELEVENLABS_STT_URL}?${params.toString()}`;
  const elevenLabsWs = new WebSocket(elevenLabsUrl, {
    headers: { 'xi-api-key': apiKey },
  });

  let elConnected = false;
  let clientOpen = true;

  function sendToClient(obj: object): void {
    if (clientOpen && clientWs.readyState === WebSocketModule.OPEN) {
      try {
        clientWs.send(JSON.stringify(obj));
      } catch (e) {
        console.warn('STT: failed to send to client:', e);
      }
    }
  }

  elevenLabsWs.on('open', () => {
    elConnected = true;
    sendToClient({ type: 'connected' });
  });

  elevenLabsWs.on('message', (data: Buffer | string) => {
    if (!clientOpen) return;
    try {
      const msg = JSON.parse(data.toString());
      const mt = msg.message_type ?? msg.type;

      if (mt === 'partial_transcript') {
        sendToClient({ type: 'partial', text: msg.text ?? '' });
      } else if (mt === 'committed_transcript' || mt === 'committed_transcript_with_timestamps') {
        sendToClient({ type: 'final', text: msg.text ?? '' });
      } else if (mt === 'session_started') {
        sendToClient({ type: 'session_started', session_id: msg.session_id });
      } else if (mt === 'error' || msg.error) {
        sendToClient({ type: 'error', error: msg.error ?? msg.message ?? 'Unknown error' });
      } else if (
        mt === 'scribe_auth_error' ||
        mt === 'scribe_quota_exceeded_error' ||
        mt === 'scribe_throttled_error' ||
        mt === 'scribe_rate_limited_error'
      ) {
        sendToClient({
          type: 'error',
          error: msg.message ?? msg.error ?? 'ElevenLabs STT error',
        });
      }
    } catch (e) {
      console.warn('STT: parse error from ElevenLabs:', e);
    }
  });

  elevenLabsWs.on('error', (err) => {
    console.error('STT: ElevenLabs WS error:', err);
    sendToClient({ type: 'error', error: err.message ?? 'ElevenLabs connection error' });
  });

  elevenLabsWs.on('close', () => {
    if (clientOpen && clientWs.readyState === WebSocketModule.OPEN) {
      clientWs.close();
    }
  });

  clientWs.on('message', (data: Buffer | string) => {
    if (!elConnected || elevenLabsWs.readyState !== WebSocketModule.OPEN) return;
    try {
      const raw = data.toString();
      const msg = JSON.parse(raw);

      if (msg.type === 'audio' && msg.base64) {
        const payload = {
          message_type: 'input_audio_chunk',
          audio_base_64: msg.base64,
          commit: !!msg.commit,
          sample_rate: 16000,
        };
        elevenLabsWs.send(JSON.stringify(payload));
      }
    } catch (e) {
      console.warn('STT: invalid client message:', e);
    }
  });

  clientWs.on('close', () => {
    clientOpen = false;
    if (elConnected && elevenLabsWs.readyState === WebSocketModule.OPEN) {
      elevenLabsWs.close();
    }
  });

  clientWs.on('error', () => {
    clientOpen = false;
    elevenLabsWs.close();
  });
}
