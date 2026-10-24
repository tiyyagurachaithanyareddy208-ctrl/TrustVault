import { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { recordAuditEvent } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES } from '@/lib/constants';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/api-response';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = LoginSchema.safeParse(body);

    if (!result.success) {
      return jsonError('Invalid request format. Valid email and password required.', 400);
    }

    const { email, password } = result.data;
    const ipAddress = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Check account lockout
    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      await recordAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        targetType: 'USER',
        targetId: user.id,
        outcome: AUDIT_OUTCOMES.DENIED,
        ipAddress,
        userAgent,
        metadata: { reason: 'Account locked due to consecutive failed attempts' },
      });

      return jsonError('Account is temporarily locked due to repeated failed login attempts. Please try again later.', 423);
    }

    // Verify user and password
    const passwordValid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !passwordValid) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        const lock = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: attempts,
            lockedUntil: lock,
          },
        });
      }

      await recordAuditEvent({
        actorId: user?.id || null,
        actorEmail: email,
        actorRole: user?.role || null,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        targetType: 'USER',
        targetId: user?.id || null,
        outcome: AUDIT_OUTCOMES.DENIED,
        ipAddress,
        userAgent,
        metadata: { reason: 'Invalid credentials provided' },
      });

      // Constant error message to prevent account enumeration
      return jsonError('Invalid email or password.', 401);
    }

    // Check account status
    if (!user.isActive) {
      await recordAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        targetType: 'USER',
        targetId: user.id,
        outcome: AUDIT_OUTCOMES.DENIED,
        ipAddress,
        userAgent,
        metadata: { reason: 'Deactivated account login attempt' },
      });

      return jsonError('Account has been deactivated. Please contact an administrator.', 403);
    }

    // Reset failed login attempts
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    // Create session and set cookie
    const token = await createSession(user.id, { userAgent, ipAddress });
    setSessionCookie(token);

    // Record successful login audit event
    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      targetType: 'SESSION',
      targetId: user.id,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      ipAddress,
      userAgent,
      metadata: { email: user.email, role: user.role },
    });

    return jsonSuccess({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
