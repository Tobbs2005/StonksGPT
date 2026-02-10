import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

type RateLimitPayload = {
  success: false;
  errorType: 'rate_limit';
  error: string;
  explanation: string;
  retryAfterSeconds: number;
  limit: number;
  windowSeconds: number;
};

function getRetryAfterSeconds(req: Request): number {
  const resetTime = (req as any).rateLimit?.resetTime as Date | undefined;
  if (!resetTime) return 60 * 60;
  return Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000));
}

export function createLlmRateLimiter(options: { maxPerHour: number }) {
  const windowMs = 60 * 60 * 1000;
  const max = options.maxPerHour;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      const retryAfterSeconds = getRetryAfterSeconds(req);
      const payload: RateLimitPayload = {
        success: false,
        errorType: 'rate_limit',
        error: `Rate limit reached (${max} requests per hour).`,
        explanation:
          'To protect our LLM API keys from abuse and control costs, this demo limits AI requests per IP address.',
        retryAfterSeconds,
        limit: max,
        windowSeconds: 60 * 60,
      };
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json(payload);
    },
  });
}

