import { NextResponse } from 'next/server';
import { authClient, authConfigured, safeNext } from '@/lib/auth/session';
import { serverEnv } from '@/lib/env/server';
import { logError } from '@/lib/log';

/** Google sends the user back here: swap the code for a session cookie, then go on. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = serverEnv().APP_ORIGIN ?? url.origin;
  const next = safeNext(url.searchParams.get('next'));
  const code = url.searchParams.get('code');
  if (!code || !authConfigured()) {
    return NextResponse.redirect(`${origin}${next}?error=1`, 303);
  }
  try {
    const sb = await authClient();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return NextResponse.redirect(`${origin}${next}`, 303);
  } catch (err) {
    logError('api/auth/callback', err);
    return NextResponse.redirect(`${origin}${next}?error=1`, 303);
  }
}
