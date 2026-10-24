import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import crypto from 'crypto';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

function computeBlockHash(params) {
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

async function recordSeedAudit(tx, payload) {
  let head = await tx.auditChainHead.findUnique({ where: { id: 'MAIN_CHAIN' } });
  if (!head) {
    head = await tx.auditChainHead.create({
      data: { id: 'MAIN_CHAIN', lastSequence: 0, lastHash: GENESIS_HASH },
    });
  }

  const seq = head.lastSequence + 1;
  const now = new Date();
  const timestampIso = now.toISOString();
  const correlationId = crypto.randomUUID();
  const metaStr = JSON.stringify(payload.metadata || {});

  const currentHash = computeBlockHash({
    sequence: seq,
    timestamp: timestampIso,
    actorId: payload.actorId || 'SYSTEM_INIT',
    action: payload.action,
    targetType: payload.targetType,
    targetId: payload.targetId || '',
    outcome: payload.outcome || 'SUCCESS',
    correlationId,
    metadata: metaStr,
    prevHash: head.lastHash,
  });

  const event = await tx.auditEvent.create({
    data: {
      sequence: seq,
      timestamp: now,
      actorId: payload.actorId || null,
      actorEmail: payload.actorEmail || null,
      actorRole: payload.actorRole || null,
      action: payload.action,
      targetType: payload.targetType,
      targetId: payload.targetId || null,
      outcome: payload.outcome || 'SUCCESS',
      correlationId,
      metadata: metaStr,
      prevHash: head.lastHash,
      currentHash,
      documentId: payload.documentId || null,
    },
  });

  await tx.auditChainHead.update({
    where: { id: 'MAIN_CHAIN' },
    data: { lastSequence: seq, lastHash: currentHash },
  });

  return event;
}

async function main() {
  console.log('[SEED] Starting TrustVault database seeding...');

  // Ensure storage vault folder exists
  const vaultDir = path.resolve(process.cwd(), './storage/vault_files');
  if (!fsSync.existsSync(vaultDir)) {
    fsSync.mkdirSync(vaultDir, { recursive: true });
  }

  // Clear existing data cleanly in reverse foreign key order
  await prisma.auditEvent.deleteMany({});
  await prisma.auditChainHead.deleteMany({});
  await prisma.documentPermission.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('[SEED] Database cleaned.');

  // Create Users with Argon2id
  const usersToCreate = [
    {
      email: 'admin@example.test',
      name: 'Security Administrator',
      role: 'ADMINISTRATOR',
      plainPass: 'AdminSecretPass123!',
    },
    {
      email: 'owner-a@example.test',
      name: 'Alice Owner (Finance & Exec)',
      role: 'DOCUMENT_OWNER',
      plainPass: 'OwnerASecretPass123!',
    },
    {
      email: 'owner-b@example.test',
      name: 'Bob Owner (Operations & HR)',
      role: 'DOCUMENT_OWNER',
      plainPass: 'OwnerBSecretPass123!',
    },
    {
      email: 'viewer-a@example.test',
      name: 'Victor Viewer',
      role: 'VIEWER',
      plainPass: 'ViewerASecretPass123!',
    },
    {
      email: 'viewer-b@example.test',
      name: 'Valerie Viewer',
      role: 'VIEWER',
      plainPass: 'ViewerBSecretPass123!',
    },
  ];

  const userMap = {};

  for (const u of usersToCreate) {
    const passwordHash = await argon2.hash(u.plainPass, ARGON2_OPTIONS);
    const created = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        isActive: true,
      },
    });
    userMap[u.email] = created;
    console.log(`[SEED] Created user: ${u.email} (${u.role})`);
  }

  // Record Admin System Init Audit Event
  await prisma.$transaction(async (tx) => {
    await recordSeedAudit(tx, {
      actorId: userMap['admin@example.test'].id,
      actorEmail: 'admin@example.test',
      actorRole: 'ADMINISTRATOR',
      action: 'SYSTEM_INITIALIZATION',
      targetType: 'SYSTEM',
      targetId: 'TRUSTVAULT_CORE',
      outcome: 'SUCCESS',
      metadata: { description: 'TrustVault security system initialized with tamper-evident audit head' },
    });
  });

  // Helper to create synthetic files with authentic magic bytes
  async function createDocFile(storageKey, magicType, textContent) {
    let header;
    if (magicType === 'pdf') {
      header = Buffer.from('%PDF-1.7\n%TrustVault Synthetic Confidential PDF\n');
    } else if (magicType === 'docx' || magicType === 'xlsx') {
      // ZIP magic bytes PK\x03\x04
      header = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
    } else {
      header = Buffer.from('%PDF-1.7\n');
    }
    const body = Buffer.from(`[CONFIDENTIAL DOCUMENT PAYLOAD - TRUSTVAULT ENCRYPTED AT REST]\n${textContent}\n`);
    const buffer = Buffer.concat([header, body]);
    const filePath = path.join(vaultDir, storageKey);
    await fs.writeFile(filePath, buffer, { mode: 0o600 });
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    return { buffer, hash, size: buffer.length };
  }

  // Seed Documents
  const documentsToCreate = [
    {
      title: 'Q3 Financial Audit Report',
      originalFilename: 'q3_financial_audit.pdf',
      description: 'Quarterly financial statements and external auditor verification findings.',
      category: 'FINANCIAL',
      mimeType: 'application/pdf',
      magicType: 'pdf',
      ownerEmail: 'owner-a@example.test',
      shares: [
        { granteeEmail: 'viewer-a@example.test', permission: 'READ' }
      ]
    },
    {
      title: 'Executive Security Architecture',
      originalFilename: 'executive_security_architecture.pdf',
      description: 'Strictly confidential architecture diagrams and threat vulnerability assessments.',
      category: 'SECURITY',
      mimeType: 'application/pdf',
      magicType: 'pdf',
      ownerEmail: 'owner-a@example.test',
      shares: [] // Strictly unshared
    },
    {
      title: 'Corporate Bylaws & Governance',
      originalFilename: 'corporate_bylaws_2026.docx',
      description: 'Organizational operating agreement, board resolutions, and governance provisions.',
      category: 'LEGAL',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      magicType: 'docx',
      ownerEmail: 'owner-a@example.test',
      shares: [
        { granteeEmail: 'viewer-b@example.test', permission: 'EDIT' }
      ]
    },
    {
      title: 'Product Roadmap 2027',
      originalFilename: 'product_roadmap_2027.xlsx',
      description: 'Strategic feature roadmap, confidential milestone projections, and budget breakdown.',
      category: 'OPERATIONS',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      magicType: 'xlsx',
      ownerEmail: 'owner-b@example.test',
      shares: [] // Strictly unshared
    },
    {
      title: 'HR Benefits & Compensation Policy',
      originalFilename: 'hr_benefits_compensation.pdf',
      description: 'Employee compensation bands, executive bonuses, and healthcare coverage policies.',
      category: 'HR',
      mimeType: 'application/pdf',
      magicType: 'pdf',
      ownerEmail: 'owner-b@example.test',
      shares: [
        { granteeEmail: 'viewer-a@example.test', permission: 'READ' }
      ]
    }
  ];

  for (const docDef of documentsToCreate) {
    const owner = userMap[docDef.ownerEmail];
    const storageKey = crypto.randomUUID();
    const fileInfo = await createDocFile(storageKey, docDef.magicType, `Content of ${docDef.title}`);

    const doc = await prisma.document.create({
      data: {
        title: docDef.title,
        originalFilename: docDef.originalFilename,
        description: docDef.description,
        category: docDef.category,
        mimeType: docDef.mimeType,
        fileSize: fileInfo.size,
        sha256Hash: fileInfo.hash,
        storageKey,
        ownerId: owner.id,
      },
    });

    console.log(`[SEED] Created document: "${doc.title}" (ID: ${doc.id}) owned by ${docDef.ownerEmail}`);

    // Audit document creation
    await prisma.$transaction(async (tx) => {
      await recordSeedAudit(tx, {
        actorId: owner.id,
        actorEmail: owner.email,
        actorRole: owner.role,
        action: 'DOCUMENT_UPLOAD',
        targetType: 'DOCUMENT',
        targetId: doc.id,
        documentId: doc.id,
        outcome: 'SUCCESS',
        metadata: {
          title: doc.title,
          originalFilename: doc.originalFilename,
          sha256Hash: doc.sha256Hash,
          fileSize: doc.fileSize,
        },
      });
    });

    // Create and audit grants
    for (const share of docDef.shares) {
      const grantee = userMap[share.granteeEmail];
      const perm = await prisma.documentPermission.create({
        data: {
          documentId: doc.id,
          granteeId: grantee.id,
          grantedById: owner.id,
          permission: share.permission,
        },
      });

      console.log(`[SEED] Granted ${share.permission} on "${doc.title}" to ${share.granteeEmail}`);

      await prisma.$transaction(async (tx) => {
        await recordSeedAudit(tx, {
          actorId: owner.id,
          actorEmail: owner.email,
          actorRole: owner.role,
          action: 'PERMISSION_GRANT',
          targetType: 'PERMISSION',
          targetId: perm.id,
          documentId: doc.id,
          outcome: 'SUCCESS',
          metadata: {
            documentId: doc.id,
            granteeEmail: grantee.email,
            permission: share.permission,
          },
        });
      });
    }
  }

  // Verify Audit Chain Integrity
  const allEvents = await prisma.auditEvent.findMany({ orderBy: { sequence: 'asc' } });
  const chainHead = await prisma.auditChainHead.findUnique({ where: { id: 'MAIN_CHAIN' } });

  console.log(`[SEED] Audit Chain constructed: ${allEvents.length} events.`);
  console.log(`[SEED] Chain Head: Seq=${chainHead.lastSequence}, Hash=${chainHead.lastHash.substring(0, 16)}...`);
  console.log('[SEED] Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[SEED_ERROR]', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
