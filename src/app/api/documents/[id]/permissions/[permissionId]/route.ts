import { NextRequest } from 'next/server';
import { requireAuthenticatedUser, requireDocumentOwner } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES } from '@/lib/constants';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { id: string; permissionId: string };
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    const authz = await requireDocumentOwner(user, params.id);
    const doc = authz.document;

    // Verify permission belongs to this document
    const permission = await prisma.documentPermission.findFirst({
      where: {
        id: params.permissionId,
        documentId: params.id,
      },
      include: {
        grantee: { select: { id: true, email: true } },
      },
    });

    if (!permission) {
      return jsonError('Permission grant not found for this document.', 404);
    }

    // Fail-closed audit event for critical permission revocation
    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AUDIT_ACTIONS.PERMISSION_REVOKE,
      targetType: 'PERMISSION',
      targetId: permission.id,
      documentId: doc.id,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      failClosed: true,
      metadata: {
        documentTitle: doc.title,
        revokedGranteeEmail: permission.grantee.email,
        revokedPermission: permission.permission,
      },
    });

    // Delete permission record atomically - takes effect immediately on next request
    await prisma.documentPermission.delete({
      where: { id: permission.id },
    });

    return jsonSuccess({ message: 'Permission access revoked successfully.' });
  } catch (err) {
    return handleApiError(err);
  }
}
