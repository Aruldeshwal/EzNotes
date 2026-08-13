import { nanoid } from 'nanoid';

/**
 * Generates a unique share token for a note.
 *
 * Uses nanoid(12) to produce a URL-safe, compact token.
 * This is called in the service layer before row creation —
 * NOT a Prisma @default(), since Prisma doesn't support
 * arbitrary function defaults. See architecture.md §2.
 */
export function generateShareToken(): string {
  return nanoid(12);
}
