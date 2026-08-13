import { describe, it, expect } from 'vitest';
import { hashIp, trackNoteView } from '../../lib/analytics';

describe('Analytics & View Deduplication', () => {
  it('hashes IP addresses consistently with salt', () => {
    const ip = '192.168.1.50';
    const hash1 = hashIp(ip);
    const hash2 = hashIp(ip);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(ip);
    expect(hash1.length).toBe(64); // sha256 hex string length
  });

  it('excludes owner views from tracking', async () => {
    const ownerId = 'user_owner_123';
    const result = await trackNoteView('token_analytics_1', ownerId, ownerId, '192.168.1.1');
    expect(result).toBe(false);
  });

  it('records viewer views and dedups within the same day', async () => {
    const ownerId = 'user_owner_123';
    const viewerId = 'user_viewer_456';
    const token = 'token_analytics_dedup';

    const firstView = await trackNoteView(token, ownerId, viewerId, '192.168.1.2');
    expect(firstView).toBe(true);

    const secondViewSameDay = await trackNoteView(token, ownerId, viewerId, '192.168.1.2');
    expect(secondViewSameDay).toBe(false);
  });
});
