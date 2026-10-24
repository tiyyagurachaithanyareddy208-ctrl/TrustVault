import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db';
import { jsonSuccess, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || '';

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        id: { not: user.id }, // Exclude self
        ...(query
          ? {
              OR: [
                { email: { contains: query } },
                { name: { contains: query } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
      take: 20,
    });

    return jsonSuccess({ users });
  } catch (err) {
    return handleApiError(err);
  }
}
