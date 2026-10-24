import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import {
  requireDocumentReadAccess,
  requireDocumentEditAccess,
  requireDocumentOwner,
  requireDocumentDownloadAccess,
  ResourceNotFoundError,
  AuthorizationError,
} from '@/lib/auth/authorization';
import { PERMISSIONS } from '@/lib/constants';

describe('Document Isolation, Server-Side Authorization & Revocation Tests', () => {
  let ownerA: any;
  let ownerB: any;
  let viewerA: any;
  let viewerB: any;
  let unsharedDocA: any;
  let sharedDocA: any;

  beforeAll(async () => {
    ownerA = await prisma.user.findUnique({ where: { email: 'owner-a@example.test' } });
    ownerB = await prisma.user.findUnique({ where: { email: 'owner-b@example.test' } });
    viewerA = await prisma.user.findUnique({ where: { email: 'viewer-a@example.test' } });
    viewerB = await prisma.user.findUnique({ where: { email: 'viewer-b@example.test' } });

    unsharedDocA = await prisma.document.findFirst({
      where: {
        title: 'Executive Security Architecture',
        ownerId: ownerA.id,
      },
    });

    sharedDocA = await prisma.document.findFirst({
      where: {
        title: 'Q3 Financial Audit Report',
        ownerId: ownerA.id,
      },
    });

    expect(ownerA).not.toBeNull();
    expect(ownerB).not.toBeNull();
    expect(viewerA).not.toBeNull();
    expect(unsharedDocA).not.toBeNull();
    expect(sharedDocA).not.toBeNull();
  });

  it('allows Owner A to read their own document', async () => {
    const authz = await requireDocumentReadAccess(ownerA, unsharedDocA.id);
    expect(authz.isOwner).toBe(true);
    expect(authz.effectivePermission).toBe('OWNER');
    expect(authz.document.id).toBe(unsharedDocA.id);
  });

  it('denies Owner B from reading Owner A unshared document (uniform 404 IDOR defense)', async () => {
    await expect(requireDocumentReadAccess(ownerB, unsharedDocA.id)).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  it('denies Viewer A from accessing an unshared document (uniform 404 IDOR defense)', async () => {
    await expect(requireDocumentReadAccess(viewerA, unsharedDocA.id)).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  it('prevents unauthorized users from guessing valid document IDs', async () => {
    // Viewer B attempts to access unsharedDocA knowing its valid UUID
    await expect(requireDocumentReadAccess(viewerB, unsharedDocA.id)).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  it('allows Viewer A to read explicitly shared document', async () => {
    const authz = await requireDocumentReadAccess(viewerA, sharedDocA.id);
    expect(authz.isOwner).toBe(false);
    expect(authz.effectivePermission).toBe(PERMISSIONS.READ);
  });

  it('prevents a READ-only viewer from gaining EDIT access', async () => {
    // Viewer A has READ on sharedDocA, attempting EDIT must be denied with 403
    await expect(requireDocumentEditAccess(viewerA, sharedDocA.id)).rejects.toThrow(
      AuthorizationError
    );
  });

  it('prevents non-owners from performing owner-only operations (delete / grant / revoke)', async () => {
    // Viewer A and Owner B attempt requireDocumentOwner on Owner A's doc
    await expect(requireDocumentOwner(viewerA, sharedDocA.id)).rejects.toThrow(
      ResourceNotFoundError
    );
    await expect(requireDocumentOwner(ownerB, sharedDocA.id)).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  it('enforces immediate revocation: revoked viewer is denied on the very next request', async () => {
    // 1. Verify Viewer A currently has access to sharedDocA
    const beforeRevocation = await requireDocumentReadAccess(viewerA, sharedDocA.id);
    expect(beforeRevocation.effectivePermission).toBe(PERMISSIONS.READ);

    // 2. Owner A revokes Viewer A's grant
    const grant = await prisma.documentPermission.findFirst({
      where: { documentId: sharedDocA.id, granteeId: viewerA.id },
    });
    expect(grant).not.toBeNull();

    await prisma.documentPermission.delete({
      where: { id: grant!.id },
    });

    // 3. Immediately on the next request, Viewer A is denied (throws 404)
    await expect(requireDocumentReadAccess(viewerA, sharedDocA.id)).rejects.toThrow(
      ResourceNotFoundError
    );

    // Also download access is immediately denied
    await expect(requireDocumentDownloadAccess(viewerA, sharedDocA.id)).rejects.toThrow(
      ResourceNotFoundError
    );

    // Restore grant for other tests
    await prisma.documentPermission.create({
      data: {
        id: grant!.id,
        documentId: sharedDocA.id,
        granteeId: viewerA.id,
        grantedById: ownerA.id,
        permission: PERMISSIONS.READ,
      },
    });

    // Verify restored access
    const restored = await requireDocumentReadAccess(viewerA, sharedDocA.id);
    expect(restored.effectivePermission).toBe(PERMISSIONS.READ);
  });
});
