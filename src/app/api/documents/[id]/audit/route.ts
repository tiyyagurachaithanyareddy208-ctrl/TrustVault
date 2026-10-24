import { NextRequest } from 'next/server';
import { requireAuthenticatedUser, requireDocumentOwner } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db';
import { jsonSuccess, handleApiError } from '@/lib/api-response';

interface RouteParams {
  params: { id: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireAuthenticatedUser(req);
    await requireDocumentOwner(user, params.id);

    const auditEvents = await prisma.auditEvent.findMany({
      where: { documentId: params.id },
      orderBy: { sequence: 'desc' },
      select: {
        id: true,
        sequence: true,
        timestamp: true,
        actorEmail: true,
        actorRole: true,
        action: true,
        targetType: true,
        outcome: true,
        correlationId: true,
        metadata: true,
        currentHash: true,
      },
      take: 100,
    });

    const parsedEvents = auditEvents.map((ev) => ({
      ...ev,
      metadata: (() => {
        try {
          return JSON.parse(ev.metadata);
        } catch {
          return {};
        }
      })(),
    }));

    return jsonSuccess({ auditEvents: parsedEvents });
  } catch (err) {
    return handleApiError(err);
  }
}
