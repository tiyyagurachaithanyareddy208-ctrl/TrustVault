import { NextRequest } from 'next/server';
import { requireAuthenticatedUser, requireAdministrator } from '@/lib/auth/authorization';
import { verifyAuditChain } from '@/lib/audit/audit-service';
import { jsonSuccess, handleApiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuthenticatedUser(req);
    await requireAdministrator(user);

    const result = await verifyAuditChain();
    return jsonSuccess({ verification: result });
  } catch (err) {
    return handleApiError(err);
  }
}
