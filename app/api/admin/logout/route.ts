import { apiRoute } from '@/lib/api/route';
import { clearedSessionCookie, sessionFromRequest, verifySessionToken } from '@/lib/admin/session';
import { adminLog } from '@/lib/db/admin';
import { serverEnv } from '@/lib/env/server';

export const POST = apiRoute('api/admin/logout', async (request) => {
  if (verifySessionToken(sessionFromRequest(request))) await adminLog('logout');
  const secure = (serverEnv().APP_ORIGIN ?? '').startsWith('https://');
  return Response.json(
    { ok: true },
    { headers: { 'cache-control': 'no-store', 'set-cookie': clearedSessionCookie(secure) } },
  );
});
