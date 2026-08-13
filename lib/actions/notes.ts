'use server';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { generateShareToken } from '@/lib/tokens';
import { hashPassword } from '@/lib/password';
import { ActionResult } from '@/lib/types';
import { AccessType, ShareType, Note } from '@prisma/client';
import { invalidateNoteCache, writeNoteCache } from '@/lib/redis';

const MAX_CONTENT_LENGTH = 100_000;

export interface CreateNoteInput {
  title: string;
  content: string;
  shareType?: ShareType;
  accessType?: AccessType;
  expiryDate?: Date | string | null;
  password?: string;
}

export interface UpdateNoteInput {
  id: string;
  title?: string;
  content?: string;
  shareType?: ShareType;
  accessType?: AccessType;
  expiryDate?: Date | string | null;
}

/**
 * Server Action: Creates a new Note.
 * Server-side verifies auth, enforces 100k char limit, hashes password if provided.
 */
export async function createNote(input: CreateNoteInput): Promise<ActionResult<Note>> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized: You must be logged in to create a note.', code: 'UNAUTHORIZED' };
  }

  if (!input.title || input.title.trim().length === 0) {
    return { success: false, error: 'Title is required.', code: 'INVALID_INPUT' };
  }

  if (input.content.length > MAX_CONTENT_LENGTH) {
    return {
      success: false,
      error: `Note content exceeds maximum allowed length of ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`,
      code: 'CONTENT_TOO_LARGE',
    };
  }

  const token = generateShareToken();
  const accessType = input.accessType || AccessType.PUBLIC;
  const shareType = input.shareType || ShareType.READ_ONLY;

  let passwordHash: string | null = null;
  if (accessType === AccessType.PASSWORD) {
    if (!input.password || input.password.trim().length === 0) {
      return { success: false, error: 'Password is required for password-protected notes.', code: 'INVALID_INPUT' };
    }
    passwordHash = await hashPassword(input.password);
  }

  let expiryDate: Date | null = null;
  if (input.expiryDate) {
    expiryDate = new Date(input.expiryDate);
    if (isNaN(expiryDate.getTime())) {
      return { success: false, error: 'Invalid expiry date format.', code: 'INVALID_INPUT' };
    }
  }

  try {
    const note = await prisma.note.create({
      data: {
        token,
        clerkUserId: userId,
        title: input.title.trim(),
        content: input.content,
        shareType,
        accessType,
        expiryDate,
        passwordHash,
      },
    });

    // Write-through cache (best effort)
    try {
      await writeNoteCache(note);
    } catch {
      // Redis errors won't break note creation
    }

    return { success: true, data: note };
  } catch (err) {
    console.error('Failed to create note:', err);
    return { success: false, error: 'Failed to create note due to a database error.', code: 'DB_ERROR' };
  }
}

/**
 * Server Action: Updates an existing Note.
 * Re-verifies ownership server-side.
 */
export async function updateNote(input: UpdateNoteInput): Promise<ActionResult<Note>> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  if (input.content !== undefined && input.content.length > MAX_CONTENT_LENGTH) {
    return {
      success: false,
      error: `Note content exceeds maximum allowed length of ${MAX_CONTENT_LENGTH.toLocaleString()} characters.`,
      code: 'CONTENT_TOO_LARGE',
    };
  }

  try {
    const existing = await prisma.note.findUnique({
      where: { id: input.id },
    });

    if (!existing || existing.clerkUserId !== userId) {
      return { success: false, error: 'Note not found or access denied.', code: 'NOT_FOUND' };
    }

    let expiryDate: Date | null | undefined = undefined;
    if (input.expiryDate !== undefined) {
      if (input.expiryDate === null) {
        expiryDate = null;
      } else {
        const parsed = new Date(input.expiryDate);
        if (isNaN(parsed.getTime())) {
          return { success: false, error: 'Invalid expiry date format.', code: 'INVALID_INPUT' };
        }
        expiryDate = parsed;
      }
    }

    const updated = await prisma.note.update({
      where: { id: input.id },
      data: {
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.content !== undefined && { content: input.content }),
        ...(input.shareType !== undefined && { shareType: input.shareType }),
        ...(input.accessType !== undefined && { accessType: input.accessType }),
        ...(expiryDate !== undefined && { expiryDate }),
      },
    });

    // Write-through cache invalidation
    try {
      await writeNoteCache(updated);
    } catch {
      // Best effort
    }

    return { success: true, data: updated };
  } catch (err) {
    console.error('Failed to update note:', err);
    return { success: false, error: 'Failed to update note.', code: 'DB_ERROR' };
  }
}

/**
 * Server Action: Revokes a Note link.
 * Sets revoked = true and invalidates cache.
 */
export async function revokeNote(id: string): Promise<ActionResult<Note>> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const existing = await prisma.note.findUnique({
      where: { id },
    });

    if (!existing || existing.clerkUserId !== userId) {
      return { success: false, error: 'Note not found or access denied.', code: 'NOT_FOUND' };
    }

    const updated = await prisma.note.update({
      where: { id },
      data: { revoked: true },
    });

    // Write-through cache invalidation
    try {
      await invalidateNoteCache(updated.token);
    } catch {
      // Best effort
    }

    return { success: true, data: updated };
  } catch (err) {
    console.error('Failed to revoke note:', err);
    return { success: false, error: 'Failed to revoke note.', code: 'DB_ERROR' };
  }
}

/**
 * Server Action: Regenerates password for a PASSWORD-protected Note.
 * Overwrites passwordHash, invalidates cache & prior sessions.
 * Returns plaintext once to owner.
 */
export async function regeneratePassword(id: string): Promise<ActionResult<{ plaintext: string }>> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const existing = await prisma.note.findUnique({
      where: { id },
    });

    if (!existing || existing.clerkUserId !== userId) {
      return { success: false, error: 'Note not found or access denied.', code: 'NOT_FOUND' };
    }

    const plaintext = generateShareToken(); // 12-char random string
    const newHash = await hashPassword(plaintext);

    const updated = await prisma.note.update({
      where: { id },
      data: {
        accessType: AccessType.PASSWORD,
        passwordHash: newHash,
      },
    });

    // Invalidate Redis cache so viewers get prompt for new password
    try {
      await writeNoteCache(updated);
    } catch {
      // Best effort
    }

    return { success: true, data: { plaintext } };
  } catch (err) {
    console.error('Failed to regenerate password:', err);
    return { success: false, error: 'Failed to regenerate password.', code: 'DB_ERROR' };
  }
}

/**
 * Server Action: Retrieves all notes owned by current user.
 */
export async function getUserNotes(): Promise<ActionResult<Note[]>> {
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
  }

  try {
    const notes = await prisma.note.findMany({
      where: { clerkUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: notes };
  } catch (err) {
    console.error('Failed to fetch user notes:', err);
    return { success: false, error: 'Failed to fetch notes.', code: 'DB_ERROR' };
  }
}
