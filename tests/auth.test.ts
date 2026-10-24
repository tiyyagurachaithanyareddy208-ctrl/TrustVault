import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, validateSessionToken, revokeSession } from '@/lib/auth/session';

describe('Authentication & Session Security Tests', () => {
  let activeUser: any;
  let inactiveUser: any;

  beforeAll(async () => {
    activeUser = await prisma.user.findUnique({
      where: { email: 'owner-a@example.test' },
    });
    expect(activeUser).not.toBeNull();

    // Create an inactive test user
    inactiveUser = await prisma.user.upsert({
      where: { email: 'deactivated@example.test' },
      update: { isActive: false },
      create: {
        email: 'deactivated@example.test',
        name: 'Deactivated User',
        role: 'VIEWER',
        passwordHash: activeUser.passwordHash,
        isActive: false,
      },
    });
  });

  it('rejects invalid passwords against Argon2id hash', async () => {
    const isValid = await verifyPassword('WrongPassword123!', activeUser.passwordHash);
    expect(isValid).toBe(false);
  });

  it('validates correct password against Argon2id hash', async () => {
    const isValid = await verifyPassword('OwnerASecretPass123!', activeUser.passwordHash);
    expect(isValid).toBe(true);
  });

  it('creates cryptographically valid sessions for active users', async () => {
    const token = await createSession(activeUser.id);
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThanOrEqual(64);

    const sessionUser = await validateSessionToken(token);
    expect(sessionUser).not.toBeNull();
    expect(sessionUser!.id).toBe(activeUser.id);
    expect(sessionUser!.email).toBe(activeUser.email);
  });

  it('denies session validation for deactivated user accounts', async () => {
    const token = await createSession(inactiveUser.id);
    const sessionUser = await validateSessionToken(token);
    // Deactivated account must fail session validation immediately
    expect(sessionUser).toBeNull();
  });

  it('invalidates session upon logout', async () => {
    const token = await createSession(activeUser.id);
    const beforeRevoke = await validateSessionToken(token);
    expect(beforeRevoke).not.toBeNull();

    await revokeSession(token);

    const afterRevoke = await validateSessionToken(token);
    expect(afterRevoke).toBeNull();
  });
});
