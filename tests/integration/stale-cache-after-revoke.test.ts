import { describe, it, expect } from 'vitest';
import { writeNoteCache, readNoteCache, invalidateNoteCache } from '../../lib/redis';
import { Note, AccessType, ShareType } from '@prisma/client';

describe('Write-through Cache Invalidation on Revoke', () => {
  it('invalidates stale cache when a note is revoked', async () => {
    const dummyNote: Note = {
      id: 'note_123',
      token: 'test_token_cache',
      clerkUserId: 'user_1',
      title: 'Sensitive Note',
      content: 'Top secret content',
      shareType: ShareType.READ_ONLY,
      accessType: AccessType.PUBLIC,
      expiryDate: null,
      passwordHash: null,
      revoked: false,
      consumedAt: null,
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Populate cache
    await writeNoteCache(dummyNote);
    const cachedBefore = await readNoteCache(dummyNote.token);
    expect(cachedBefore).not.toBeNull();
    expect(cachedBefore?.revoked).toBe(false);

    // Simulate revoke mutation path which calls invalidateNoteCache()
    await invalidateNoteCache(dummyNote.token);

    // Cache read after invalidation should be null or reflect revoked
    const cachedAfter = await readNoteCache(dummyNote.token);
    expect(cachedAfter).toBeNull();
  });
});
