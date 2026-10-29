import { apiRoute } from '@/lib/api/route';
import { authClient, authConfigured } from '@/lib/auth/session';

/** Sign out on this device (the session cookies are cleared). */
export const POST = apiRoute('api/auth/logout', async () => {
  if (authConfigured()) await (await authClient()).auth.signOut({ scope: 'local' });
  return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
});
