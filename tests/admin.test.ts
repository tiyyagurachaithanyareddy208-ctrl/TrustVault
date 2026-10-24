import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import {
  requireAdministrator,
  requireDocumentReadAccess,
  requireDocumentDownloadAccess,
  AuthorizationError,
  ResourceNotFoundError,
} from '@/lib/auth/authorization';

describe('Administrative Boundary & Confidentiality Tests', () => {
  let admin: any;
  let ownerA: any;
  let viewerA: any;
  let unsharedDocA: any;

  beforeAll(async () => {
    admin = await prisma.user.findUnique({ where: { email: 'admin@example.test' } });
    ownerA = await prisma.user.findUnique({ where: { email: 'owner-a@example.test' } });
    viewerA = await prisma.user.findUnique({ where: { email: 'viewer-a@example.test' } });

    unsharedDocA = await prisma.document.findFirst({
      where: {
        title: 'Executive Security Architecture',
        ownerId: ownerA.id,
      },
    });

    expect(admin).not.toBeNull();
    expect(ownerA).not.toBeNull();
    expect(unsharedDocA).not.toBeNull();
  });

  it('allows verified Administrator to pass requireAdministrator', async () => {
    const verifiedAdmin = await requireAdministrator(admin);
    expect(verifiedAdmin.role).toBe('ADMINISTRATOR');
  });

  it('strictly blocks non-administrators from accessing administrative controls', async () => {
    await expect(requireAdministrator(ownerA)).rejects.toThrow(AuthorizationError);
    await expect(requireAdministrator(viewerA)).rejects.toThrow(AuthorizationError);
  });

  it('PREVENTS ADMINISTRATORS FROM AUTOMATICALLY READING CONFIDENTIAL DOCUMENTS', async () => {
    // Administrator does NOT hold an explicit grant on unsharedDocA
    // Attempting to read document content must be denied (404 IDOR defense)
    await expect(requireDocumentReadAccess(admin, unsharedDocA.id)).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  it('PREVENTS ADMINISTRATORS FROM DOWNLOADING CONFIDENTIAL DOCUMENT PAYLOADS', async () => {
    // Attempting to download confidential file bytes must be denied
    await expect(requireDocumentDownloadAccess(admin, unsharedDocA.id)).rejects.toThrow(
      ResourceNotFoundError
    );
  });
});
