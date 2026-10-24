import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES, GENESIS_HASH } from '@/lib/constants';

export class AuditPersistenceError extends Error {
  constructor(message: string) {
    super(`Audit Persistence Failure (Fail-Closed): ${message}`);
    this.name = 'AuditPersistenceError';
  }
}

export interface AuditEventPayload {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  outcome: 'SUCCESS' | 'DENIED';
  correlationId?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
  documentId?: string | null;
  failClosed?: boolean; // If true, throws AuditPersistenceError on failure
}

/**
 * Sanitizes metadata so confidential information (passwords, tokens, file contents)
 * is never persisted to the audit trail.
 */
export function sanitizeAuditMetadata(metadata?: Record<string, unknown>): string {
  if (!metadata) return '{}';
  const forbiddenKeys = ['password', 'token', 'secret', 'authorization', 'cookie', 'filebuffer', 'content', 'signature'];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase();
    if (forbiddenKeys.some(forbidden => lowerKey.includes(forbidden))) {
      sanitized[key] = '[REDACTED_SENSITIVE_DATA]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = JSON.parse(sanitizeAuditMetadata(value as Record<string, unknown>));
    } else {
      sanitized[key] = value;
    }
  }

  // Canonical JSON representation with sorted keys
  return JSON.stringify(sanitized, Object.keys(sanitized).sort());
}

/**
 * Computes canonical SHA-256 hash for an audit block.
 */
export function computeBlockHash(params: {
  sequence: number;
  timestamp: string; // ISO 8601 string
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  outcome: string;
  correlationId: string;
  metadata: string;
  prevHash: string;
}): string {
  const canonicalString = [
    params.sequence.toString(),
    params.timestamp,
    params.actorId,
    params.action,
    params.targetType,
    params.targetId,
    params.outcome,
    params.correlationId,
    params.metadata,
    params.prevHash,
  ].join('|');

  return crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
}

/**
 * Atomically records an audit event into the tamper-evident hash chain.
 * Enforces sequential monotonicity and concurrency serialization.
 */
export async function recordAuditEvent(payload: AuditEventPayload) {
  const correlationId = payload.correlationId || crypto.randomUUID();
  const sanitizedMeta = sanitizeAuditMetadata(payload.metadata);
  const now = new Date();
  const timestampIso = now.toISOString();

  // Critical events require fail-closed behavior
  const isCritical =
    payload.failClosed ||
    payload.action === AUDIT_ACTIONS.PERMISSION_GRANT ||
    payload.action === AUDIT_ACTIONS.PERMISSION_REVOKE ||
    payload.action === AUDIT_ACTIONS.DOCUMENT_DELETE ||
    payload.action === AUDIT_ACTIONS.USER_STATUS_CHANGE;

  try {
    return await prisma.$transaction(async (tx) => {
      // 1. Fetch or initialize the audit chain head with concurrency control
      let chainHead = await tx.auditChainHead.findUnique({
        where: { id: 'MAIN_CHAIN' },
      });

      if (!chainHead) {
        chainHead = await tx.auditChainHead.create({
          data: {
            id: 'MAIN_CHAIN',
            lastSequence: 0,
            lastHash: GENESIS_HASH,
          },
        });
      }

      const nextSequence = chainHead.lastSequence + 1;
      const prevHash = chainHead.lastHash;

      // 2. Resolve actorId if user exists to satisfy foreign key integrity
      let resolvedActorId: string | null = null;
      if (payload.actorId) {
        const user = await tx.user.findUnique({
          where: { id: payload.actorId },
          select: { id: true },
        });
        if (user) {
          resolvedActorId = user.id;
        }
      }

      // 3. Compute canonical cryptographic hash over immutable persisted values
      const canonicalActor = resolvedActorId || payload.actorEmail || 'SYSTEM_ANONYMOUS';
      const currentHash = computeBlockHash({
        sequence: nextSequence,
        timestamp: timestampIso,
        actorId: canonicalActor,
        action: payload.action,
        targetType: payload.targetType,
        targetId: payload.targetId || '',
        outcome: payload.outcome,
        correlationId,
        metadata: sanitizedMeta,
        prevHash,
      });

      // 4. Persist the immutable audit block
      const event = await tx.auditEvent.create({
        data: {
          sequence: nextSequence,
          timestamp: now,
          actorId: resolvedActorId,
          actorEmail: payload.actorEmail || null,
          actorRole: payload.actorRole || null,
          action: payload.action,
          targetType: payload.targetType,
          targetId: payload.targetId || null,
          outcome: payload.outcome,
          correlationId,
          ipAddress: payload.ipAddress || null,
          userAgent: payload.userAgent || null,
          metadata: sanitizedMeta,
          prevHash,
          currentHash,
          documentId: payload.documentId || null,
        },
      });

      // 4. Update the chain head
      await tx.auditChainHead.update({
        where: { id: 'MAIN_CHAIN' },
        data: {
          lastSequence: nextSequence,
          lastHash: currentHash,
        },
      });

      return event;
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[AUDIT_ERROR] Failed to record audit event [${payload.action}]:`, errorMsg);
    if (isCritical) {
      throw new AuditPersistenceError(
        `Critical operation ${payload.action} aborted because audit trail write failed: ${errorMsg}`
      );
    }
    return null;
  }
}

export interface ChainVerificationResult {
  isValid: boolean;
  totalEvents: number;
  lastSequence: number;
  chainHeadHash: string;
  verifiedAt: string;
  errors: string[];
}

/**
 * Validates the entire cryptographic hash chain from genesis to head.
 * Detects modified payloads, broken sequence order, altered previous hashes, and chain head mismatches.
 */
export async function verifyAuditChain(): Promise<ChainVerificationResult> {
  const errors: string[] = [];
  const events = await prisma.auditEvent.findMany({
    orderBy: { sequence: 'asc' },
  });

  const chainHead = await prisma.auditChainHead.findUnique({
    where: { id: 'MAIN_CHAIN' },
  });

  if (events.length === 0) {
    const headSequence = chainHead?.lastSequence ?? 0;
    if (headSequence !== 0) {
      errors.push(`Chain head reports lastSequence=${headSequence} but zero audit records exist in database.`);
    }
    return {
      isValid: errors.length === 0,
      totalEvents: 0,
      lastSequence: 0,
      chainHeadHash: chainHead?.lastHash || GENESIS_HASH,
      verifiedAt: new Date().toISOString(),
      errors,
    };
  }

  let expectedPrevHash = GENESIS_HASH;
  let expectedSequence = 1;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];

    // Check sequence continuity
    if (ev.sequence !== expectedSequence) {
      errors.push(
        `Sequence mismatch at index ${i}: expected sequence ${expectedSequence}, but found ${ev.sequence} (ID: ${ev.id})`
      );
    }

    // Check link to previous block
    if (ev.prevHash !== expectedPrevHash) {
      errors.push(
        `Broken hash chain at sequence ${ev.sequence} (ID: ${ev.id}): prevHash '${ev.prevHash}' does not match expected '${expectedPrevHash}'`
      );
    }

    // Recalculate block hash over canonical payload
    const canonicalActor = ev.actorId || ev.actorEmail || 'SYSTEM_ANONYMOUS';
    const recalculatedHash = computeBlockHash({
      sequence: ev.sequence,
      timestamp: ev.timestamp.toISOString(),
      actorId: canonicalActor,
      action: ev.action,
      targetType: ev.targetType,
      targetId: ev.targetId || '',
      outcome: ev.outcome,
      correlationId: ev.correlationId,
      metadata: ev.metadata,
      prevHash: ev.prevHash,
    });

    if (ev.currentHash !== recalculatedHash) {
      errors.push(
        `Tampered or corrupted block detected at sequence ${ev.sequence} (ID: ${ev.id}): stored hash '${ev.currentHash}' does not match cryptographic recomputation '${recalculatedHash}'`
      );
    }

    expectedPrevHash = ev.currentHash;
    expectedSequence = ev.sequence + 1;
  }

  // Check agreement with chain head record
  if (!chainHead) {
    errors.push('Missing AuditChainHead record in database.');
  } else {
    const lastEvent = events[events.length - 1];
    if (chainHead.lastSequence !== lastEvent.sequence) {
      errors.push(
        `Chain head sequence desynchronization: chain head reports ${chainHead.lastSequence}, but last event is ${lastEvent.sequence}`
      );
    }
    if (chainHead.lastHash !== lastEvent.currentHash) {
      errors.push(
        `Chain head hash desynchronization: chain head reports '${chainHead.lastHash}', but last event hash is '${lastEvent.currentHash}'`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    totalEvents: events.length,
    lastSequence: events[events.length - 1].sequence,
    chainHeadHash: chainHead?.lastHash || expectedPrevHash,
    verifiedAt: new Date().toISOString(),
    errors,
  };
}
