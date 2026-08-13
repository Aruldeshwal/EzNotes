import crypto from 'crypto';
import { recordViewCount } from './redis';

const APP_SECRET = process.env.APP_SECRET || 'dev-fallback-secret-at-least-32-chars-long';

/**
 * Computes a privacy-preserving salted IP hash.
 * Per SECURITY.md: Raw IPs are never stored long-term.
 */
export function hashIp(ip: string): string {
  return crypto.createHmac('sha256', APP_SECRET).update(ip).digest('hex');
}

/**
 * Records a view for a note, excluding owner views.
 * Deduped per-day via Redis set.
 */
export async function trackNoteView(
  token: string,
  noteOwnerId: string,
  currentUserId?: string | null,
  ip = '127.0.0.1',
): Promise<boolean> {
  // Exclude owner views
  if (currentUserId && currentUserId === noteOwnerId) {
    return false;
  }

  const viewerId = currentUserId ? `user:${currentUserId}` : `ip:${hashIp(ip)}`;
  const dateStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC

  return recordViewCount(token, dateStr, viewerId);
}
