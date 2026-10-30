import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { serverEnv } from '@/lib/env/server';

/**
 * Optional Google sign-in (D-085), through Supabase Auth with the publishable key. The session
 * lives in httpOnly cookies set by our own routes; the browser never talks to Supabase
 * directly. Data access still goes through lib/db with the user id, never through RLS.
 */

export interface SessionUser {
  id: string;
  email: string | null;
  /** The Google profile picture, shown only to the user themselves (D-102). */
  avatarUrl: string | null;
}

const GOOGLE_AVATAR_HOST = 'lh3.googleusercontent.com';

/**
 * The profile picture Google sent at sign-in, if it really is a Google one. user_metadata can
 * be changed by the user through Supabase, so anything else is dropped (the CSP allows only
 * this host for images too).
 */
export function googleAvatar(meta: Record<string, unknown> | undefined): string | null {
  const raw = meta?.avatar_url ?? meta?.picture;
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === GOOGLE_AVATAR_HOST ? url.href : null;
  } catch {
    return null;
  }
}

export function authConfigured(): boolean {
  const env = serverEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

/** A Supabase client bound to this request's cookies (route handlers only: it may set them). */
export async function authClient() {
  const env = serverEnv();
  const store = await cookies();
  // Secure whenever the site is served over https (Vercel's proxy says so), even if
  // APP_ORIGIN is missing; plain http only in local dev.
  const secure =
    (await headers()).get('x-forwarded-proto') === 'https' ||
    (env.APP_ORIGIN ?? '').startsWith('https://');
  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          for (const { name, value, options } of list) {
            store.set(name, value, { ...options, httpOnly: true, secure, sameSite: 'lax' });
          }
        },
      },
    },
  );
}

/** The signed-in user, verified with Supabase Auth (refreshing the session if needed). */
export async function currentUser(): Promise<SessionUser | null> {
  if (!authConfigured()) return null;
  const sb = await authClient();
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  if (!isGoogleAccount(data.user.app_metadata)) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? null,
    avatarUrl: googleAvatar(data.user.user_metadata),
  };
}

/**
 * Only Google accounts count (D-085). Supabase's email sign-up is reachable with the public
 * key, so an account made that way must not own posts. app_metadata is set by Supabase only.
 */
export function isGoogleAccount(meta: { provider?: string; providers?: string[] }): boolean {
  return (meta.providers ?? (meta.provider ? [meta.provider] : [])).includes('google');
}

/**
 * Where to go after signing in: a path on this site only (no `//host` or `/\host` tricks).
 * Defaults to the page that tells the opener and closes itself.
 */
export function safeNext(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/signed-in';
  }
  return next;
}
