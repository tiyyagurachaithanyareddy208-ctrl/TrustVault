import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { revokeSession, clearSessionCookie, SESSION_COOKIE_NAME, validateSessionToken } from '@/lib/auth/session';
import { recordAuditEvent } from '@/lib/audit/audit-service';
import { AUDIT_ACTIONS, AUDIT_OUTCOMES } from '@/lib/constants';
import { jsonSuccess, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }
    if (!token) {
      const cookieStore = cookies();
      token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    }

    if (token) {
      const user = await validateSessionToken(token);
      await revokeSession(token);
      clearSessionCookie();

      if (user) {
        await recordAuditEvent({
          actorId: user.id,
          actorEmail: user.email,
          actorRole: user.role,
          action: AUDIT_ACTIONS.AUTH_LOGOUT,
          targetType: 'SESSION',
          targetId: user.id,
          outcome: AUDIT_OUTCOMES.SUCCESS,
        });
      }
    } else {
      clearSessionCookie();
    }

    return jsonSuccess({ message: 'Successfully logged out.' });
  } catch (err) {
    return handleApiError(err);
  }
}
