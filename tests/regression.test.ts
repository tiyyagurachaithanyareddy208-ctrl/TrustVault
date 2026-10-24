import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import {
  requireDocumentReadAccess,
  ResourceNotFoundError,
  AuthenticatedUser,
} from '@/lib/auth/authorization';

/**
 * SIMULATED FLAWED IMPLEMENTATION:
 * Demonstrates what happens if a developer introduces an Insecure Direct Object Reference (IDOR)
 * by removing the server-side ownership and grant authorization check.
 */
async function flawedInsecureDocumentFetch(user: AuthenticatedUser, documentId: string) {
  // FLAW: Only fetches the document by ID without validating ownerId or explicit grants!
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
  });
  if (!doc) throw new ResourceNotFoundError();
  return doc; // Vulnerability: returns document directly to any caller!
}

describe('Security Regression Testing (Authorization Check Removal)', () => {
  let ownerA: any;
  let attackerViewerB: any;
  let confidentialDoc: any;

  beforeAll(async () => {
    ownerA = await prisma.user.findUnique({ where: { email: 'owner-a@example.test' } });
    attackerViewerB = await prisma.user.findUnique({ where: { email: 'viewer-b@example.test' } });

    confidentialDoc = await prisma.document.findFirst({
      where: {
        title: 'Executive Security Architecture',
        ownerId: ownerA.id,
      },
    });

    expect(ownerA).not.toBeNull();
    expect(attackerViewerB).not.toBeNull();
    expect(confidentialDoc).not.toBeNull();
  });

  it('VERIFIES THAT SECURE IMPLEMENTATION REJECTS UNAUTHORIZED USER', async () => {
    // Under the real secure implementation, attackerViewerB is rejected
    await expect(requireDocumentReadAccess(attackerViewerB, confidentialDoc.id)).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  it('DEMONSTRATES THAT REMOVING THE AUTHORIZATION CHECK EXPOSES CONFIDENTIAL DATA (REGRESSION DEMONSTRATION)', async () => {
    // If the server-side authorization check is removed, the insecure function leaks the document!
    const leakedDoc = await flawedInsecureDocumentFetch(attackerViewerB, confidentialDoc.id);

    // This assertion proves that without requireDocumentReadAccess, the document is improperly exposed:
    expect(leakedDoc).not.toBeNull();
    expect(leakedDoc.id).toBe(confidentialDoc.id);
    expect(leakedDoc.title).toBe('Executive Security Architecture');
  });
});
