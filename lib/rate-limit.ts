import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';

// In-memory fallback rate limiter for testing/offline environments
const memoryStore = new Map<string, { count: number; resetAt: number }>();

function checkMemoryRateLimit(identifier: string, limit: number, windowMs: number): { success: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count };
}

export const rateLimiters = {
  globalApi: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(100, '1 m'),
        analytics: true,
        prefix: 'ratelimit:global_api',
      })
    : null,

  noteCreation: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(15, '1 m'),
        analytics: true,
        prefix: 'ratelimit:note_creation',
      })
    : null,

  settingsUpdate: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(15, '1 m'),
        analytics: true,
        prefix: 'ratelimit:settings_update',
      })
    : null,

  publicShareLoad: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        analytics: true,
        prefix: 'ratelimit:public_share_load',
      })
    : null,

  collaborativePatches: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        analytics: true,
        prefix: 'ratelimit:collab_patches',
      })
    : null,
};

export async function checkRateLimit(
  limiterName: keyof typeof rateLimiters,
  identifier: string,
  fallbackLimit = 100,
  windowMs = 60000,
): Promise<{ success: boolean; remaining: number }> {
  const limiter = rateLimiters[limiterName];
  if (limiter) {
    const res = await limiter.limit(identifier);
    return { success: res.success, remaining: res.remaining };
  }
  return checkMemoryRateLimit(`${limiterName}:${identifier}`, fallbackLimit, windowMs);
}
