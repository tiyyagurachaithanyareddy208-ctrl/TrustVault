import { NextRequest } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/auth/authorization';
import { jsonSuccess, handleApiError } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    return jsonSuccess({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
