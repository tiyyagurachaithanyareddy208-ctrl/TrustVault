import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db';
import { ROLES, AUDIT_ACTIONS, AUDIT_OUTCOMES } from '@/lib/constants';
import { validateUploadedFile } from '@/lib/validation/upload-validator';
import { storage, computeSha256, generateStorageKey } from '@/lib/storage/storage-service';
import { recordAuditEvent } from '@/lib/audit/audit-service';
import { jsonSuccess, jsonError, handleApiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('search')?.trim() || '';
    const category = searchParams.get('category')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const sortBy = ['createdAt', 'title', 'category', 'fileSize'].includes(searchParams.get('sort') || '')
      ? (searchParams.get('sort') as string)
      : 'createdAt';
    const sortOrder = searchParams.get('order') === 'asc' ? 'asc' : 'desc';

    // Server-side Authorization Filter:
    // Non-admins discover ONLY owned documents or documents explicitly granted to them.
    // Administrators discover system document metadata for administrative oversight.
    const accessFilter =
      user.role === ROLES.ADMINISTRATOR
        ? {}
        : {
            OR: [
              { ownerId: user.id },
              { permissions: { some: { granteeId: user.id } } },
            ],
          };

    const whereClause: any = {
      isDeleted: false,
      ...accessFilter,
    };

    if (search) {
      whereClause.AND = [
        {
          OR: [
            { title: { contains: search } },
            { originalFilename: { contains: search } },
            { description: { contains: search } },
          ],
        },
      ];
    }

    if (category) {
      whereClause.category = category;
    }

    const [total, documents] = await prisma.$transaction([
      prisma.document.count({ where: whereClause }),
      prisma.document.findMany({
        where: whereClause,
        include: {
          owner: {
            select: { id: true, name: true, email: true },
          },
          permissions: {
            where: { granteeId: user.id },
            select: { permission: true },
          },
          _count: {
            select: { permissions: true },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Format minimum required metadata and compute effective permission
    const items = documents.map((doc) => {
      let effectivePermission = 'NONE';
      if (doc.ownerId === user.id) {
        effectivePermission = 'OWNER';
      } else if (doc.permissions[0]) {
        effectivePermission = doc.permissions[0].permission;
      } else if (user.role === ROLES.ADMINISTRATOR) {
        effectivePermission = 'ADMIN_METADATA_ONLY';
      }

      return {
        id: doc.id,
        title: doc.title,
        originalFilename: doc.originalFilename,
        description: doc.description,
        category: doc.category,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        sha256Hash: doc.sha256Hash,
        owner: doc.owner,
        isOwner: doc.ownerId === user.id,
        effectivePermission,
        grantCount: doc._count.permissions,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      };
    });

    return jsonSuccess({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);

    // Viewers cannot upload unless granted owner role
    if (user.role === ROLES.VIEWER) {
      return jsonError('Viewers do not have permission to upload documents.', 403);
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string | null)?.trim();
    const description = (formData.get('description') as string | null)?.trim() || null;
    const category = (formData.get('category') as string | null)?.trim() || 'GENERAL';

    if (!file || !title) {
      return jsonError('File payload and document title are required.', 400);
    }

    // Convert file to Node buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Strict server-side upload validation (Magic bytes, extension, MIME, size)
    const validation = validateUploadedFile(buffer, file.name, file.type);
    if (!validation.isValid) {
      await recordAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: AUDIT_ACTIONS.SECURITY_VALIDATION_FAILURE,
        targetType: 'DOCUMENT',
        outcome: AUDIT_OUTCOMES.DENIED,
        metadata: {
          filename: file.name,
          error: validation.error,
          declaredMime: file.type,
        },
      });

      return jsonError(validation.error || 'File validation failed.', 400);
    }

    // 2. Compute SHA-256 content hash and generate random internal storage key
    const sha256Hash = computeSha256(buffer);
    const storageKey = generateStorageKey();

    // 3. Save to private storage outside web root
    await storage.save(buffer, storageKey);

    try {
      // 4. Save metadata in PostgreSQL / Prisma
      const document = await prisma.document.create({
        data: {
          title,
          originalFilename: validation.sanitizedFilename,
          description,
          category,
          mimeType: validation.detectedMimeType,
          fileSize: validation.fileSize,
          sha256Hash,
          storageKey,
          ownerId: user.id,
        },
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
      });

      // 5. Record successful upload in audit trail
      await recordAuditEvent({
        actorId: user.id,
        actorEmail: user.email,
        actorRole: user.role,
        action: AUDIT_ACTIONS.DOCUMENT_UPLOAD,
        targetType: 'DOCUMENT',
        targetId: document.id,
        documentId: document.id,
        outcome: AUDIT_OUTCOMES.SUCCESS,
        metadata: {
          title: document.title,
          originalFilename: document.originalFilename,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          sha256Hash: document.sha256Hash,
        },
      });

      return jsonSuccess(
        {
          id: document.id,
          title: document.title,
          originalFilename: document.originalFilename,
          category: document.category,
          mimeType: document.mimeType,
          fileSize: document.fileSize,
          sha256Hash: document.sha256Hash,
          owner: document.owner,
          createdAt: document.createdAt,
        },
        201
      );
    } catch (dbErr) {
      // Clean up orphaned storage file if database save fails
      await storage.delete(storageKey);
      throw dbErr;
    }
  } catch (err) {
    return handleApiError(err);
  }
}
