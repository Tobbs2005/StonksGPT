/**
 * Unified LLM Provider with Automatic Fallback
 *
 * Primary:  Google Gemini
 * Fallback: OpenAI gpt-5-nano (via Dedalus Labs)
 *
 * Detects Gemini credit exhaustion / rate limits and seamlessly falls back.
 * For text generation tasks (insights, summaries) — NOT for deterministic
 * data pipelines like chart formatting.
 *
 * Environment variables:
 *   GEMINI_API_KEY         – required for Gemini
 *   DEDALUS_API_KEY        – required for OpenAI fallback
 *   FORCE_OPENAI_FALLBACK  – set to "true" to skip Gemini entirely
 */

import { Dedalus } from 'dedalus-labs';

// ── Lazy singletons ──────────────────────────────────────────────────
let geminiClient: any = null;
let dedalusClient: Dedalus | null = null;

function getGeminiClient(): any {
  if (!geminiClient) {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

function getDedalusClient(): Dedalus {
  if (!dedalusClient) {
    dedalusClient = new Dedalus();
  }
  return dedalusClient;
}

// ── Helpers ──────────────────────────────────────────────────────────

const OPENAI_MODEL = 'openai/gpt-5-nano';
const GEMINI_MODEL = 'gemini-3-flash-preview';

/** Returns true when the error signals credit / quota / rate-limit exhaustion. */
function isExhaustionError(error: any): boolean {
  const msg = String(error?.message || error || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('rate') ||
    msg.includes('billing') ||
    msg.includes('exhausted') ||
    msg.includes('credit') ||
    msg.includes('resource_exhausted') ||
    msg.includes('insufficient') ||
    msg.includes('402') ||
    msg.includes('too many requests')
  );
}

const forceOpenAI = () =>
  process.env.FORCE_OPENAI_FALLBACK === 'true' || process.env.FORCE_OPENAI_FALLBACK === '1';

// ── Provider implementations ─────────────────────────────────────────

async function generateWithGemini(prompt: string, systemPrompt?: string): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
  const result = await model.generateContent(fullPrompt);
  const response = await result.response;
  return response.text().trim();
}

async function generateWithOpenAI(prompt: string, systemPrompt?: string): Promise<string> {
  const client = getDedalusClient();
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    messages,
  });

  return ((response as any).choices?.[0]?.message?.content || '').trim();
}

// ── Public API ───────────────────────────────────────────────────────

export interface GenerateOptions {
  /** Optional system prompt prepended to the request. */
  systemPrompt?: string;
}

/**
 * Generate text using Gemini with automatic fallback to OpenAI gpt-5-nano.
 *
 * The `provider` field in the return value indicates which model answered.
 */
export async function generateText(
  prompt: string,
  options?: GenerateOptions,
): Promise<{ text: string; provider: 'gemini' | 'openai' }> {
  const sys = options?.systemPrompt;

  // ── Fast path: forced fallback ──
  if (forceOpenAI()) {
    console.log('[llm-provider] FORCE_OPENAI_FALLBACK enabled — using OpenAI gpt-5-nano');
    const text = await generateWithOpenAI(prompt, sys);
    return { text, provider: 'openai' };
  }

  // ── Primary: Gemini ──
  try {
    const text = await generateWithGemini(prompt, sys);
    console.log('[llm-provider] Response from Gemini');
    return { text, provider: 'gemini' };
  } catch (error: any) {
    if (isExhaustionError(error)) {
      console.warn('[llm-provider] Gemini exhausted/rate-limited, falling back to OpenAI gpt-5-nano');
    } else {
      console.warn('[llm-provider] Gemini error, falling back to OpenAI gpt-5-nano:', error.message);
    }
  }

  // ── Fallback: OpenAI via Dedalus ──
  try {
    const text = await generateWithOpenAI(prompt, sys);
    console.log('[llm-provider] Response from OpenAI (fallback)');
    return { text, provider: 'openai' };
  } catch (fallbackError: any) {
    console.error('[llm-provider] Both Gemini and OpenAI failed:', fallbackError.message);
    throw new Error(`LLM generation failed: ${fallbackError.message}`);
  }
}
