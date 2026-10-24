import { NextRequest } from 'next/server';
import { requireAuthenticatedUser, requireAdministrator } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db';
import { verifyAuditChain } from '@/lib/audit/audit-service';
import { jsonSuccess, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    await requireAdministrator(user);

    // Compute aggregated system metrics without reading confidential file bytes
    const [
      totalUsers,
      activeUsers,
      totalDocuments,
      deniedEventsCount,
      recentSecurityEvents,
      categoryCounts,
      chainStatus,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.document.count({ where: { isDeleted: false } }),
      prisma.auditEvent.count({ where: { outcome: 'DENIED' } }),
      prisma.auditEvent.findMany({
        where: {
          OR: [
            { outcome: 'DENIED' },
            { action: { contains: 'SECURITY' } },
            { action: { contains: 'USER_' } },
          ],
        },
        orderBy: { sequence: 'desc' },
        take: 10,
        select: {
          id: true,
          sequence: true,
          timestamp: true,
          actorEmail: true,
          actorRole: true,
          action: true,
          targetType: true,
          outcome: true,
          metadata: true,
        },
      }),
      prisma.document.groupBy({
        by: ['category'],
        where: { isDeleted: false },
        _count: { id: true },
      }),
      verifyAuditChain(),
    ]);

    const formattedEvents = recentSecurityEvents.map((ev) => ({
      ...ev,
      metadata: (() => {
        try {
          return JSON.parse(ev.metadata);
        } catch {
          return {};
        }
      })(),
    }));

    return jsonSuccess({
      metrics: {
        totalUsers,
        activeUsers,
        totalDocuments,
        deniedEventsCount,
        chainHeadHash: chainStatus.chainHeadHash,
        chainValid: chainStatus.isValid,
        totalAuditEvents: chainStatus.totalEvents,
      },
      categoryBreakdown: categoryCounts.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
      recentSecurityEvents: formattedEvents,
      chainStatus,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
