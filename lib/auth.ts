import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const APP_SECRET = process.env.APP_SECRET || 'dev-fallback-secret-at-least-32-chars-long';

/**
 * Derives a per-note signing key by computing HMAC-SHA256(APP_SECRET, noteId + createdAt).
 * Per SECURITY.md, this prevents a leaked secret from allowing forged tokens for arbitrary notes.
 */

export function deriveNoteSigningKey(noteId: string, createdAt: Date | string): Uint8Array {
  const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const timeStr = isNaN(d.getTime()) ? String(createdAt) : d.toISOString();
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

export async function setNoteSessionCookie(
  token: string,
  jwt: string,
  response?: NextResponse,
): Promise<void> {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: `/`,
    maxAge: 300,
  };

  if (response) {
    // Route Handler path: set cookie directly on the response object
    response.cookies.set(`session_${token}`, jwt, cookieOptions);
  } else {
    // Server Action / Server Component path: use cookies() API
    const cookieStore = await cookies();
    cookieStore.set(`session_${token}`, jwt, cookieOptions);
  }
}

/**
 * Helper to get the session JWT from cookies.
 */
export async function getNoteSessionCookie(token: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(`session_${token}`)?.value;
}
