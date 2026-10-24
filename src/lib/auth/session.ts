import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { User } from '@prisma/client';

export const SESSION_COOKIE_NAME = 'trustvault_session';
export const SESSION_DURATION_HOURS = 12;

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
}

export interface SessionData {
  sessionToken: string;
  user: AuthenticatedUser;
}

/**
 * Creates a cryptographically random session token and persists it to the database.
 */
export async function createSession(userId: string, metadata?: { userAgent?: string; ipAddress?: string }): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
      userAgent: metadata?.userAgent || null,
      ipAddress: metadata?.ipAddress || null,
    },
  });

  return token;
}

/**
 * Sets the secure HTTP-only session cookie in the response.
 */
export function setSessionCookie(token: string) {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_HOURS * 3600,
  });
}

/**
 * Clears the session cookie.
 */
export function clearSessionCookie() {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Validates a session token directly against the database.
 * Strictly verifies account active status and expiration.
 */
export async function validateSessionToken(token: string): Promise<AuthenticatedUser | null> {
  if (!token || typeof token !== 'string' || token.length < 32) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;

  // Verify non-revocation and expiration
  if (session.revoked || session.expiresAt < new Date()) {
    return null;
  }

  // Account must be active
  if (!session.user || !session.user.isActive) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    isActive: session.user.isActive,
  };
}

/**
 * Revokes a session in the database.
 */
export async function revokeSession(token: string): Promise<void> {
  if (!token) return;
  await prisma.session.updateMany({
    where: { token },
    data: { revoked: true },
  });
}

/**
 * Revokes all sessions for a specific user (e.g., when account is deactivated or compromised).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId },
    data: { revoked: true },
  });
}
