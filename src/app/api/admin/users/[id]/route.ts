import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser, requireAdministrator } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db';
import { revokeAllUserSessions } from '@/lib/auth/session';
import { recordAuditEvent } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, ROLES } from '@/lib/constants';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UpdateUserSchema = z.object({
  role: z.enum([ROLES.ADMINISTRATOR, ROLES.DOCUMENT_OWNER, ROLES.VIEWER]).optional(),
  isActive: z.boolean().optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAuthenticatedUser(req);
    await requireAdministrator(admin);

    const targetUser = await prisma.user.findUnique({
      where: { id: params.id },
    });

    if (!targetUser) {
      return jsonError('User not found.', 404);
    }

    const body = await req.json();
    const result = UpdateUserSchema.safeParse(body);
    if (!result.success) {
      return jsonError('Invalid user update payload.', 400, result.error.errors);
    }

    const { role, isActive } = result.data;

    // Safety constraint: Administrator cannot deactivate their own active account
    if (params.id === admin.id && isActive === false) {
      return jsonError('Administrators cannot deactivate their own administrative account.', 400);
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });

    // If account was deactivated, immediately invalidate all active sessions
    if (isActive === false) {
      await revokeAllUserSessions(params.id);
    }

    // Fail-closed audit event for critical account status modification
    await recordAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      actorRole: admin.role,
      action: AUDIT_ACTIONS.USER_STATUS_CHANGE,
      targetType: 'USER',
      targetId: updated.id,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      failClosed: true,
      metadata: {
        targetUserEmail: updated.email,
        previousState: { role: targetUser.role, isActive: targetUser.isActive },
        newState: { role: updated.role, isActive: updated.isActive },
      },
    });

    return jsonSuccess({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        isActive: updated.isActive,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
