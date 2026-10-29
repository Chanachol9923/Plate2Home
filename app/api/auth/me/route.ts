import { apiRoute } from '@/lib/api/route';
import { currentUser } from '@/lib/auth/session';

/** Who is signed in (only the email, to show and to prefill the contact form). */
export const GET = apiRoute('api/auth/me', async () => {
  const user = await currentUser();
  return Response.json(
    { user: user && { email: user.email } },
    { headers: { 'cache-control': 'no-store' } },
  );
});
