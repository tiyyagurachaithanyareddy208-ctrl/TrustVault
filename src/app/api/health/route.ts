import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { storage } from '@/lib/storage/storage-service';
import { verifyAuditChain } from '@/lib/audit/audit-service';

export async function GET() {
  const timestamp = new Date().toISOString();
  let dbHealthy = false;
  let storageHealthy = false;
  let auditHealthy = false;
  const errors: string[] = [];

  // 1. Check Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch (err: unknown) {
    errors.push(`Database check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. Check Storage Access
  try {
    const testKey = '00000000-0000-0000-0000-000000000000';
    await storage.exists(testKey);
    storageHealthy = true;
  } catch (err: unknown) {
    errors.push(`Storage check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Check Audit Chain Head
  try {
    const chainHead = await prisma.auditChainHead.findUnique({ where: { id: 'MAIN_CHAIN' } });
    if (chainHead) {
      auditHealthy = true;
    } else {
      errors.push('Audit chain head record missing.');
    }
  } catch (err: unknown) {
    errors.push(`Audit head check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const isHealthy = dbHealthy && storageHealthy && auditHealthy;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp,
      services: {
        database: dbHealthy ? 'up' : 'down',
        storage: storageHealthy ? 'up' : 'down',
        auditChain: auditHealthy ? 'up' : 'down',
      },
      ...(errors.length > 0 ? { errors } : {}),
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}
