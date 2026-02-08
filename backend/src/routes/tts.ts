import { Router, Request, Response } from 'express';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

const router = Router();
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_MODEL = 'eleven_multilingual_v2';

// Lazy-init client (API key required)
let client: ElevenLabsClient | null = null;
function getClient(): ElevenLabsClient {
  if (!client) {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }
    client = new ElevenLabsClient({ apiKey: key });
  }
  return client;
}

/**
 * POST /api/tts
 * Body: { text: string, voiceId?: string, modelId?: string }
 * Returns: audio/mpeg binary
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, voiceId = DEFAULT_VOICE_ID, modelId = DEFAULT_MODEL } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text is required and must be a string' });
    }

    const elevenlabs = getClient();
    const response = await elevenlabs.textToSpeech.convert(voiceId, {
      text: text.trim(),
      modelId,
    });
    const stream = (response as { data?: AsyncIterable<Uint8Array> | ReadableStream }).data ?? response;

    res.setHeader('Content-Type', 'audio/mpeg');
    if (typeof (stream as ReadableStream).getReader === 'function') {
      const reader = (stream as ReadableStream<Uint8Array>).getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } else {
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        res.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    }
    res.end();
  } catch (error: any) {
    console.error('TTS error:', error);
    const status = error?.status === 401 ? 401 : error?.status === 429 ? 429 : 500;
    const message =
      error?.message || (error?.status === 401 ? 'Invalid API key' : 'TTS request failed');
    res.status(status).json({ success: false, error: message });
  }
});

export default router;
