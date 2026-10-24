import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { AuthenticatedUser, SESSION_COOKIE_NAME, validateSessionToken } from './session';
import { ROLES, PERMISSIONS, AUDIT_ACTIONS, AUDIT_OUTCOMES } from '@/lib/constants';
import { recordAuditEvent } from '@/lib/audit/audit-service';

export class AuthenticationError extends Error {
  statusCode: number;
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = 401;
  }
}

export class AuthorizationError extends Error {
  statusCode: number;
  constructor(message = 'Access denied: insufficient permissions.', statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

export class ResourceNotFoundError extends Error {
  statusCode: number;
  constructor(message = 'Requested document was not found.') {
    super(message);
    this.name = 'ResourceNotFoundError';
    this.statusCode = 404;
  }
}

/**
 * Extracts and validates the authenticated user from the session cookie or Authorization header.
 * Throws AuthenticationError (401) if invalid or missing.
 */
export async function requireAuthenticatedUser(req?: Request): Promise<AuthenticatedUser> {
  let token: string | undefined;

  // Check Authorization Bearer header first if present
  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
  }

  // Fallback to HTTP-only cookie
  if (!token) {
    const cookieStore = cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  }

  if (!token) {
    throw new AuthenticationError('Authentication required. Missing session credentials.');
  }

  const user = await validateSessionToken(token);
  if (!user) {
    throw new AuthenticationError('Invalid, expired, or deactivated session.');
  }

  return user;
}

/**
 * Validates that the user account is fully active.
 */
export async function requireActiveUser(user: AuthenticatedUser): Promise<AuthenticatedUser> {
  if (!user.isActive) {
    throw new AuthorizationError('Account has been deactivated. Access denied.', 403);
  }
  return user;
}

/**
 * Requires Administrator role.
 */
export async function requireAdministrator(user: AuthenticatedUser): Promise<AuthenticatedUser> {
  await requireActiveUser(user);
  if (user.role !== ROLES.ADMINISTRATOR) {
    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AUDIT_ACTIONS.AUTHZ_ACCESS_DENIED,
      targetType: 'SYSTEM',
      targetId: 'ADMIN_PANEL',
      outcome: AUDIT_OUTCOMES.DENIED,
      metadata: { reason: 'User lacks ADMINISTRATOR role' },
    });
    throw new AuthorizationError('Administrative privilege required.', 403);
  }
  return user;
}

export interface DocumentAuthorizationResult {
  document: {
    id: string;
    title: string;
    originalFilename: string;
    description: string | null;
    category: string;
    mimeType: string;
    fileSize: number;
    sha256Hash: string;
    storageKey: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  isOwner: boolean;
  effectivePermission: 'OWNER' | 'EDIT' | 'READ';
}

/**
 * Validates READ access to a document.
 * Permits:
 *  - Document Owner
 *  - Users with explicit READ or EDIT document permission grants
 * DENIES:
 *  - Administrators without explicit grants (No administrative confidentiality bypass)
 *  - Any other user (returns 404 to eliminate resource enumeration)
 */
export async function requireDocumentReadAccess(
  user: AuthenticatedUser,
  documentId: string
): Promise<DocumentAuthorizationResult> {
  await requireActiveUser(user);

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      isDeleted: false,
    },
    include: {
      permissions: {
        where: { granteeId: user.id },
      },
    },
  });

  if (!document) {
    throw new ResourceNotFoundError();
  }

  // 1. Owner has full READ access
  if (document.ownerId === user.id) {
    return {
      document,
      isOwner: true,
      effectivePermission: 'OWNER',
    };
  }

  // 2. Check explicit permission grants
  const grant = document.permissions[0];
  if (grant && (grant.permission === PERMISSIONS.READ || grant.permission === PERMISSIONS.EDIT)) {
    return {
      document,
      isOwner: false,
      effectivePermission: grant.permission as 'READ' | 'EDIT',
    };
  }

  // 3. Deny access & record security audit event
  await recordAuditEvent({
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
    action: AUDIT_ACTIONS.AUTHZ_ACCESS_DENIED,
    targetType: 'DOCUMENT',
    targetId: documentId,
    outcome: AUDIT_OUTCOMES.DENIED,
    documentId: documentId,
    metadata: { reason: 'Unauthorized read attempt on document' },
  });

  // Return 404 to prevent resource enumeration
  throw new ResourceNotFoundError();
}

/**
 * Validates EDIT access to a document.
 * Permits:
 *  - Document Owner
 *  - Users with explicit EDIT grant
 */
export async function requireDocumentEditAccess(
  user: AuthenticatedUser,
  documentId: string
): Promise<DocumentAuthorizationResult> {
  const authz = await requireDocumentReadAccess(user, documentId);

  if (authz.isOwner || authz.effectivePermission === PERMISSIONS.EDIT) {
    return authz;
  }

  await recordAuditEvent({
    actorId: user.id,
    actorEmail: user.email,
    actorRole: user.role,
    action: AUDIT_ACTIONS.AUTHZ_ACCESS_DENIED,
    targetType: 'DOCUMENT',
    targetId: documentId,
    outcome: AUDIT_OUTCOMES.DENIED,
    documentId: documentId,
    metadata: { reason: 'User holds READ-only permission, edit requested' },
  });

  throw new AuthorizationError('Edit permission required for this document.', 403);
}

/**
 * Validates that the user is the explicit OWNER of the document.
 * Required for deletion, granting/revoking permissions, or transferring ownership.
 */
export async function requireDocumentOwner(
  user: AuthenticatedUser,
  documentId: string
): Promise<DocumentAuthorizationResult> {
  await requireActiveUser(user);

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      isDeleted: false,
    },
  });

  if (!document) {
    throw new ResourceNotFoundError();
  }

  if (document.ownerId !== user.id) {
    await recordAuditEvent({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: AUDIT_ACTIONS.AUTHZ_ACCESS_DENIED,
      targetType: 'DOCUMENT',
      targetId: documentId,
      outcome: AUDIT_OUTCOMES.DENIED,
      documentId: documentId,
      metadata: { reason: 'Non-owner attempted owner-restricted operation' },
    });

    // Return 404 to avoid leaking ownership existence
    throw new ResourceNotFoundError();
  }

  return {
    document,
    isOwner: true,
    effectivePermission: 'OWNER',
  };
}

/**
 * Validates download access to a document file payload.
 * Strictly verifies READ access. Streams 0 bytes on denial.
 */
export async function requireDocumentDownloadAccess(
  user: AuthenticatedUser,
  documentId: string
): Promise<DocumentAuthorizationResult> {
  return await requireDocumentReadAccess(user, documentId);
}
