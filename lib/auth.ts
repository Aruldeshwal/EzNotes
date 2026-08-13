import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const APP_SECRET = process.env.APP_SECRET || 'dev-fallback-secret-at-least-32-chars-long';

/**
 * Derives a per-note signing key by computing HMAC-SHA256(APP_SECRET, noteId + createdAt).
 * Per SECURITY.md, this prevents a leaked secret from allowing forged tokens for arbitrary notes.
 */

export function deriveNoteSigningKey(noteId: string, createdAt: Date | string): Uint8Array {
  const timeStr = typeof createdAt === 'string' ? createdAt : createdAt.toISOString();
  const hmac = crypto.createHmac('sha256', APP_SECRET);
  hmac.update(`${noteId}:${timeStr}`);
  return new Uint8Array(hmac.digest());
}

export interface NoteSessionPayload {
  token: string;
  noteId: string;
  accessType: string;
  iat?: number;
  exp?: number;
}

/**
 * Mints a short-lived (~5 minute) JWT for a specific note session.
 */
export async function createNoteSessionJwt(
  noteId: string,
  createdAt: Date | string,
  token: string,
  accessType: string,
): Promise<string> {
  const secretKey = deriveNoteSigningKey(noteId, createdAt);
  return new SignJWT({ token, noteId, accessType })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(secretKey);
}

/**
 * Verifies a note session JWT using the derived per-note key.
 */
export async function verifyNoteSessionJwt(
  jwtToken: string,
  noteId: string,
  createdAt: Date | string,
): Promise<NoteSessionPayload | null> {
  try {
    const secretKey = deriveNoteSigningKey(noteId, createdAt);
    const { payload } = await jwtVerify(jwtToken, secretKey);
    return payload as unknown as NoteSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Helper to set the httpOnly cookie for note access.
 */
export async function setNoteSessionCookie(token: string, jwt: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(`session_${token}`, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: `/`,
    maxAge: 300, // 5 minutes
  });
}

/**
 * Helper to get the session JWT from cookies.
 */
export async function getNoteSessionCookie(token: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(`session_${token}`)?.value;
}
