import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser, requireDocumentOwner } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db';
import { recordAuditEvent } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, PERMISSIONS } from '@/lib/constants';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/api-response';

const CreatePermissionSchema = z.object({
  granteeEmail: z.string().email(),
  permission: z.enum([PERMISSIONS.READ, PERMISSIONS.EDIT]),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    await requireDocumentOwner(user, params.id);

    const permissions = await prisma.documentPermission.findMany({
      where: { documentId: params.id },
      include: {
        grantee: { select: { id: true, name: true, email: true, role: true, isActive: true } },
        grantedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jsonSuccess({ permissions });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    const authz = await requireDocumentOwner(user, params.id);
    const doc = authz.document;

    const body = await req.json();
    const result = CreatePermissionSchema.safeParse(body);
    if (!result.success) {
      return jsonError('Invalid permission parameters.', 400, result.error.errors);
    }

    const { granteeEmail, permission } = result.data;

    // Resolve grantee user
    const grantee = await prisma.user.findUnique({
      where: { email: granteeEmail.toLowerCase().trim() },
    });

    if (!grantee) {
      return jsonError(`User with email '${granteeEmail}' does not exist.`, 404);
    }

    if (!grantee.isActive) {
      return jsonError(`Cannot grant access to deactivated user '${granteeEmail}'.`, 400);
    }

    // Owner cannot grant permission to themselves (they already own it)
    if (grantee.id === user.id) {
      return jsonError('Document owner already holds full access to this document.', 400);
    }

    // Upsert permission atomically
    const grant = await prisma.documentPermission.upsert({
      where: {
        documentId_granteeId: {
          documentId: doc.id,
          granteeId: grantee.id,
        },
      },
      update: {
        permission,
        grantedById: user.id,
      },
      create: {
        documentId: doc.id,
        granteeId: grantee.id,
        grantedById: user.id,
        permission,
      },
      include: {
        grantee: { select: { id: true, name: true, email: true } },
      },
    });

    // Fail-closed audit event for critical permission grant
    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AUDIT_ACTIONS.PERMISSION_GRANT,
      targetType: 'PERMISSION',
      targetId: grant.id,
      documentId: doc.id,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      failClosed: true,
      metadata: {
        documentTitle: doc.title,
        granteeEmail: grantee.email,
        permission,
      },
    });

    return jsonSuccess({ permission: grant }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
