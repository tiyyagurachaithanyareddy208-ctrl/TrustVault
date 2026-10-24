import { NextRequest } from 'next/server';
import { requireAuthenticatedUser, requireAdministrator } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db';
import { jsonSuccess, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    await requireAdministrator(user);

    const { searchParams } = new URL(req.url);
    const actor = searchParams.get('actor')?.trim() || '';
    const action = searchParams.get('action')?.trim() || '';
    const outcome = searchParams.get('outcome')?.trim() || '';
    const targetType = searchParams.get('targetType')?.trim() || '';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));

    const where: any = {};

    if (actor) {
      where.OR = [
        { actorEmail: { contains: actor } },
        { actorId: { contains: actor } },
      ];
    }

    if (action) {
      where.action = action;
    }

    if (outcome) {
      where.outcome = outcome;
    }

    if (targetType) {
      where.targetType = targetType;
    }

    const [total, events] = await prisma.$transaction([
      prisma.auditEvent.count({ where }),
      prisma.auditEvent.findMany({
        where,
        orderBy: { sequence: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          sequence: true,
          timestamp: true,
          actorId: true,
          actorEmail: true,
          actorRole: true,
          action: true,
          targetType: true,
          targetId: true,
          outcome: true,
          correlationId: true,
          ipAddress: true,
          metadata: true,
          prevHash: true,
          currentHash: true,
        },
      }),
    ]);

    const items = events.map((ev) => ({
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
