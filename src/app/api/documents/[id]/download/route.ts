import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser, requireDocumentDownloadAccess } from '@/lib/auth/authorization';
import { storage } from '@/lib/storage/storage-service';
import { recordAuditEvent } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES } from '@/lib/constants';
import { handleApiError } from '@/lib/api-response';

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // 1. Authenticate user
    const user = await requireAuthenticatedUser(req);

    // 2. Authorize download (Enforces READ access, deny-by-default, checks active user)
    const authz = await requireDocumentDownloadAccess(user, params.id);
    const doc = authz.document;

    // 3. Read private file from server-side storage
    const fileBuffer = await storage.read(doc.storageKey);

    // 4. Record successful download in audit trail
    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AUDIT_ACTIONS.DOCUMENT_DOWNLOAD,
      targetType: 'DOCUMENT',
      targetId: doc.id,
      documentId: doc.id,
      outcome: AUDIT_OUTCOMES.SUCCESS,
      metadata: {
        filename: doc.originalFilename,
        fileSize: doc.fileSize,
        sha256Hash: doc.sha256Hash,
      },
    });

    // 5. Stream file payload with hardened security headers
    // Sanitize filename for Content-Disposition header
    const safeHeaderFilename = encodeURIComponent(doc.originalFilename);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': doc.mimeType,
        'Content-Length': fileBuffer.length.toString(),
        'Content-Disposition': `attachment; filename="${doc.originalFilename.replace(/"/g, '')}"; filename*=UTF-8''${safeHeaderFilename}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
