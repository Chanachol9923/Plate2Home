'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton';
import { Link } from '@/i18n/navigation';
import { readDevicePosts } from '@/lib/client/devices';
import { inAppBrowser } from '@/lib/client/inapp';
import { useSession } from '@/lib/client/session';

function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

const noSubscribe = () => () => undefined;

/**
 * The sign-in part of the home page, fitted to the visitor (D-093, D-099): signed in, one line
 * saying the posts follow the account; signed out, a short question (posts on this device or
 * not) and the Google button itself, so signing in is one tap from here (signing in links this
 * device's posts, D-094). Inside LINE and the like, where Google sign-in fails, it links to
 * "My posts", which explains how to open the page in the phone's browser.
 */
export function HomeAccountHint() {
  const t = useTranslations('home.account');
  const session = useSession();
  // Unknown (null) on the server and during hydration; read from this device afterwards.
  const hasDevicePosts = useSyncExternalStore(
    subscribeStorage,
    () => readDevicePosts().length > 0,
    () => null,
  );
  const inApp = useSyncExternalStore(
    noSubscribe,
    () => inAppBrowser(navigator.userAgent) !== null,
    () => false,
  );

  let content = null;
  if (session.status === 'signed-in') {
    content = (
      <Link href="/my-posts" className="text-sm text-ink-muted underline underline-offset-4">
        {t('signedIn')}
      </Link>
    );
  } else if (session.status === 'signed-out' && hasDevicePosts !== null) {
    content = inApp ? (
      <Link href="/my-posts" className="text-sm font-semibold underline underline-offset-4">
        {t(hasDevicePosts ? 'deviceOnly' : 'elsewhere')}
      </Link>
    ) : (
      <>
        <p className="text-sm">{t(hasDevicePosts ? 'deviceOnlyLead' : 'elsewhereLead')}</p>
        <GoogleSignInButton />
      </>
    );
  }

  // Keeps the signed-out height while loading so the page below does not jump.
  return (
    <div className="mt-4 flex min-h-24 flex-col items-center gap-2 text-center">{content}</div>
  );
}
