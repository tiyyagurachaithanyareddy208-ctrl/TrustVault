import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { recordAuditEvent, verifyAuditChain, computeBlockHash } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, GENESIS_HASH } from '@/lib/constants';

describe('Audit Trail & Tamper-Evident Hash Chain', () => {
  it('successfully verifies a valid cryptographic hash chain', async () => {
    const result = await verifyAuditChain();
    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.totalEvents).toBeGreaterThan(0);
    expect(result.lastSequence).toBe(result.totalEvents);
  });

  it('records consecutive events maintaining monotonic sequence and valid hashes', async () => {
    const ev1 = await recordAuditEvent({
      actorId: 'test-user-1',
      actorEmail: 'test1@example.com',
      actorRole: 'VIEWER',
      action: 'TEST_ACTION_1',
      targetType: 'DOCUMENT',
      targetId: 'doc-1',
      outcome: 'SUCCESS',
      metadata: { note: 'event 1' },
    });

    const ev2 = await recordAuditEvent({
      actorId: 'test-user-2',
      actorEmail: 'test2@example.com',
      actorRole: 'VIEWER',
      action: 'TEST_ACTION_2',
      targetType: 'DOCUMENT',
      targetId: 'doc-2',
      outcome: 'SUCCESS',
      metadata: { note: 'event 2' },
    });

    expect(ev1).not.toBeNull();
    expect(ev2).not.toBeNull();
    expect(ev2!.sequence).toBe(ev1!.sequence + 1);
    expect(ev2!.prevHash).toBe(ev1!.currentHash);

    const verification = await verifyAuditChain();
    if (!verification.isValid) console.log('Verification errors:', verification.errors);
    expect(verification.isValid).toBe(true);
  });

  it('detects tampering when an audit event payload is modified in the database', async () => {
    // Record a fresh event
    const ev = await recordAuditEvent({
      actorId: 'tamper-target',
      actorEmail: 'victim@example.com',
      actorRole: 'DOCUMENT_OWNER',
      action: 'DOCUMENT_UPLOAD',
      targetType: 'DOCUMENT',
      targetId: 'tamper-doc',
      outcome: 'SUCCESS',
      metadata: { originalState: 'clean' },
    });
    expect(ev).not.toBeNull();

    // Maliciously tamper with the stored action directly in the DB
    await prisma.auditEvent.update({
      where: { id: ev!.id },
      data: { action: 'FORGED_ADMIN_BYPASS' },
    });

    const verification = await verifyAuditChain();
    expect(verification.isValid).toBe(false);
    expect(verification.errors.some(e => e.includes('Tampered or corrupted block detected'))).toBe(true);

    // Restore original action to restore chain validity
    await prisma.auditEvent.update({
      where: { id: ev!.id },
      data: { action: 'DOCUMENT_UPLOAD' },
    });

    const restoredVerification = await verifyAuditChain();
    expect(restoredVerification.isValid).toBe(true);
  });

  it('detects tampering when an event is deleted from the middle of the chain', async () => {
    const ev = await recordAuditEvent({
      actorId: 'to-be-deleted',
      action: 'TEMPORARY_EVENT',
      targetType: 'TEST',
      outcome: 'SUCCESS',
    });
    expect(ev).not.toBeNull();

    const evAfter = await recordAuditEvent({
      actorId: 'after-deleted',
      action: 'SUBSEQUENT_EVENT',
      targetType: 'TEST',
      outcome: 'SUCCESS',
    });
    expect(evAfter).not.toBeNull();

    // Delete the intermediate event to verify tamper detection
    await prisma.auditEvent.delete({
      where: { id: ev!.id },
    });

    const verification = await verifyAuditChain();
    expect(verification.isValid).toBe(false);
    expect(verification.errors.some(e => e.includes('Sequence mismatch') || e.includes('Broken hash chain'))).toBe(true);

    // Re-insert the deleted event to leave database in clean state
    await prisma.auditEvent.create({
      data: {
        id: ev!.id,
        sequence: ev!.sequence,
        timestamp: ev!.timestamp,
        actorId: ev!.actorId,
        actorEmail: ev!.actorEmail,
        actorRole: ev!.actorRole,
        action: ev!.action,
        targetType: ev!.targetType,
        targetId: ev!.targetId,
        outcome: ev!.outcome,
        correlationId: ev!.correlationId,
        metadata: ev!.metadata,
        prevHash: ev!.prevHash,
        currentHash: ev!.currentHash,
      },
    });

    const cleanVerification = await verifyAuditChain();
    expect(cleanVerification.isValid).toBe(true);
  });
});
