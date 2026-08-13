import { Note } from '@prisma/client';

/**
 * Placeholder Redis helper module.
 * Will be fully implemented in Phase 3 with @upstash/redis.
 */

export async function writeNoteCache(note: Note): Promise<void> {
  // Stub for Phase 2 - will be replaced in Phase 3
  void note;
}

export async function invalidateNoteCache(token: string): Promise<void> {
  // Stub for Phase 2 - will be replaced in Phase 3
  void token;
}
