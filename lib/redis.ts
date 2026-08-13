import { Redis } from '@upstash/redis';
import { Note } from '@prisma/client';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

// In-memory fallback store when Upstash credentials are not provided (e.g. in vitest/local)
const memoryStore = new Map<string, { value: unknown; expiresAt?: number }>();
const memorySets = new Map<string, Set<string>>();

function getMemory(key: string): unknown | null {
  const item = memoryStore.get(key);
  if (!item) return null;
  if (item.expiresAt && Date.now() > item.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return item.value;
}

function setMemory(key: string, value: unknown, ttlSeconds?: number): void {
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
  memoryStore.set(key, { value, expiresAt });
}

function deleteMemory(key: string): void {
  memoryStore.delete(key);
}

export const redis =
  url && token && !url.includes('example.upstash.io')
    ? new Redis({ url, token })
    : null;

// --- Key Builders ---
export const RedisKeys = {
  note: (t: string) => `note:${t}`,
  noteViews: (t: string) => `note:views:${t}`,
  noteDailyViews: (t: string, date: string) => `note:daily_views:${t}:${date}`,
  lockNote: (t: string) => `lock:note:${t}`,
  fails: (t: string, ip: string) => `fails:${t}:${ip}`,
  lockout: (t: string, ip: string) => `lockout:${t}:${ip}`,
  viewed: (t: string) => `viewed:${t}`,
};

// --- Note Cache Helpers ---

export async function writeNoteCache(note: Note): Promise<void> {
  const key = RedisKeys.note(note.token);
  const payload = JSON.stringify(note);
  const ttl = 3600; // 1 hour

  if (redis) {
    await redis.set(key, payload, { ex: ttl });
  } else {
    setMemory(key, payload, ttl);
  }
}

export async function readNoteCache(noteToken: string): Promise<Note | null> {
  const key = RedisKeys.note(noteToken);
  let data: string | null = null;

  if (redis) {
    data = await redis.get<string>(key);
  } else {
    data = getMemory(key) as string | null;
  }

  if (!data) return null;
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    // Revive date objects
    if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
    if (parsed.updatedAt) parsed.updatedAt = new Date(parsed.updatedAt);
    if (parsed.expiryDate) parsed.expiryDate = new Date(parsed.expiryDate);
    if (parsed.consumedAt) parsed.consumedAt = new Date(parsed.consumedAt);
    return parsed as Note;
  } catch {
    return null;
  }
}

export async function invalidateNoteCache(noteToken: string): Promise<void> {
  const key = RedisKeys.note(noteToken);
  if (redis) {
    await redis.del(key);
  } else {
    deleteMemory(key);
  }
}

// --- One-Time Lock Fast Path ---

export async function acquireOneTimeLock(noteToken: string): Promise<boolean> {
  const key = RedisKeys.lockNote(noteToken);
  if (redis) {
    const res = await redis.set(key, '1', { nx: true, ex: 5 });
    return res === 'OK';
  } else {
    if (getMemory(key)) return false;
    setMemory(key, '1', 5);
    return true;
  }
}

// --- Password Failure & Lockout Helpers ---

export async function checkLockout(noteToken: string, ip: string): Promise<boolean> {
  const key = RedisKeys.lockout(noteToken, ip);
  if (redis) {
    const exists = await redis.exists(key);
    return exists === 1;
  } else {
    return getMemory(key) !== null;
  }
}

export async function recordPasswordFailure(noteToken: string, ip: string): Promise<{ fails: number; isLockedOut: boolean }> {
  const failKey = RedisKeys.fails(noteToken, ip);
  const lockoutKey = RedisKeys.lockout(noteToken, ip);

  let fails = 0;
  if (redis) {
    fails = await redis.incr(failKey);
    if (fails === 1) {
      await redis.expire(failKey, 60); // 60s rolling window
    }
    if (fails >= 5) {
      await redis.set(lockoutKey, '1', { ex: 900 }); // 15 min lockout
      return { fails, isLockedOut: true };
    }
  } else {
    const current = (getMemory(failKey) as number || 0) + 1;
    setMemory(failKey, current, 60);
    fails = current;
    if (fails >= 5) {
      setMemory(lockoutKey, '1', 900);
      return { fails, isLockedOut: true };
    }
  }

  return { fails, isLockedOut: false };
}

// --- View Analytics Helpers ---

export async function recordViewCount(noteToken: string, dateStr: string, viewerId: string): Promise<boolean> {
  const dedupKey = RedisKeys.viewed(noteToken);
  const viewsKey = RedisKeys.noteViews(noteToken);
  const dailyKey = RedisKeys.noteDailyViews(noteToken, dateStr);

  if (redis) {
    const isNew = await redis.sadd(dedupKey, viewerId);
    if (isNew === 1) {
      await redis.expire(dedupKey, 93600); // 26 hours
      await redis.incr(viewsKey);
      await redis.incr(dailyKey);
      await redis.expire(dailyKey, 93600);
      return true;
    }
    return false;
  } else {
    let set = memorySets.get(dedupKey);
    if (!set) {
      set = new Set<string>();
      memorySets.set(dedupKey, set);
    }
    if (!set.has(viewerId)) {
      set.add(viewerId);
      const v = (getMemory(viewsKey) as number || 0) + 1;
      const dv = (getMemory(dailyKey) as number || 0) + 1;
      setMemory(viewsKey, v);
      setMemory(dailyKey, dv, 93600);
      return true;
    }
    return false;
  }
}
