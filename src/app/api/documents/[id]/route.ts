import { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  requireAuthenticatedUser,
  requireDocumentReadAccess,
  requireDocumentEditAccess,
  requireDocumentOwner,
} from '@/lib/auth/authorization';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage/storage-service';
import { recordAuditEvent } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, DOCUMENT_CATEGORIES } from '@/lib/constants';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    const authz = await requireDocumentReadAccess(user, params.id);

    const doc = await prisma.document.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        permissions: {
          select: {
            id: true,
            permission: true,
            createdAt: true,
            grantee: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!doc) {
      return jsonError('Document not found.', 404);
    }

    // Record view audit event
    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AUDIT_ACTIONS.DOCUMENT_VIEW,
      targetType: 'DOCUMENT',
      targetId: doc.id,
      documentId: doc.id,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      metadata: { effectivePermission: authz.effectivePermission },
    });

    return jsonSuccess({
      id: doc.id,
      title: doc.title,
      originalFilename: doc.originalFilename,
      description: doc.description,
      category: doc.category,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      sha256Hash: doc.sha256Hash,
      owner: doc.owner,
      isOwner: authz.isOwner,
      effectivePermission: authz.effectivePermission,
      permissions: authz.isOwner ? doc.permissions : [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    const authz = await requireDocumentEditAccess(user, params.id);

    const body = await req.json();
    const result = UpdateDocumentSchema.safeParse(body);
    if (!result.success) {
      return jsonError('Invalid update payload.', 400, result.error.errors);
    }

    const { title, description, category } = result.data;
    const oldDoc = authz.document;

    const updated = await prisma.document.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(category !== undefined ? { category } : {}),
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AUDIT_ACTIONS.DOCUMENT_UPDATE,
      targetType: 'DOCUMENT',
      targetId: updated.id,
      documentId: updated.id,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      metadata: {
        changes: {
          title: title !== undefined ? { from: oldDoc.title, to: title } : undefined,
          category: category !== undefined ? { from: oldDoc.category, to: category } : undefined,
        },
      },
    });

    return jsonSuccess({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    // Strict Owner authorization required for deletion
    const authz = await requireDocumentOwner(user, params.id);
    const doc = authz.document;

    // Fail-closed audit logging on deletion
    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AUDIT_ACTIONS.DOCUMENT_DELETE,
      targetType: 'DOCUMENT',
      targetId: doc.id,
      documentId: doc.id,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      failClosed: true,
      metadata: {
        title: doc.title,
        originalFilename: doc.originalFilename,
        sha256Hash: doc.sha256Hash,
      },
    });

    // Delete record and storage payload safely
    await prisma.document.delete({
      where: { id: params.id },
    });

    await storage.delete(doc.storageKey);

    return jsonSuccess({ message: 'Document deleted successfully.' });
  } catch (err) {
    return handleApiError(err);
  }
}
