import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/api/route';
import { authClient, authConfigured, safeNext } from '@/lib/auth/session';
import { serverEnv } from '@/lib/env/server';
import { logError } from '@/lib/log';
import { clientIp, hashIp } from '@/lib/security/ip';

/**
 * Start Google sign-in (D-085). Opened in a pop-up so the page underneath keeps its photos
 * and form; PKCE keeps the code verifier in an httpOnly cookie until the callback.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = serverEnv().APP_ORIGIN ?? url.origin;
  const next = safeNext(url.searchParams.get('next'));
  const failed = () => NextResponse.redirect(`${origin}${next}?error=1`, 303);
  if (!authConfigured()) return failed();
  try {
    await enforceRateLimit('auth:login', hashIp(clientIp(request.headers)));
    const sb = await authClient();
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
        skipBrowserRedirect: true,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error || !data.url) throw error ?? new Error('no_url');
    return NextResponse.redirect(data.url, 303);
  } catch (err) {
    logError('api/auth/login', err);
    return failed();
  }
}
