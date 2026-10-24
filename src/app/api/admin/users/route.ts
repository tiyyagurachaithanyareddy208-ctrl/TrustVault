import { NextRequest } from 'next/server';
import { requireAuthenticatedUser, requireAdministrator } from '@/lib/auth/authorization';
import { prisma } from '@/lib/db';
import { jsonSuccess, handleApiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    await requireAdministrator(user);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search')?.trim() || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            documents: { where: { isDeleted: false } },
            permissions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jsonSuccess({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        isActive: u.isActive,
        failedLoginAttempts: u.failedLoginAttempts,
        lockedUntil: u.lockedUntil,
        documentCount: u._count.documents,
        grantCount: u._count.permissions,
        createdAt: u.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
