'use client';

import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { Link } from '@/i18n/navigation';
import { readDevicePosts } from '@/lib/client/devices';
import { useSession } from '@/lib/client/session';

function subscribeStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

/**
 * The line under "My posts" on the home page, fitted to the visitor (D-093): signed in, it
 * says the posts follow the account (no email here; "My posts" shows it); signed out with posts on this device, it offers signing
 * in to see them elsewhere too (signing in links them, D-085); otherwise it tells someone who
 * posted on another phone how to find that post here.
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

  let text: string | null = null;
  if (session.status === 'signed-in') {
    text = t('signedIn');
  } else if (session.status === 'signed-out' && hasDevicePosts !== null) {
    text = hasDevicePosts ? t('deviceOnly') : t('elsewhere');
  }

  // Keeps its height while loading so the page below does not jump.
  return (
    <p className="mt-3 min-h-[2.5rem] text-center text-sm">
      {text && (
        <Link
          href="/my-posts"
          className={
            session.status === 'signed-in'
              ? 'text-ink-muted underline underline-offset-4'
              : 'font-semibold underline underline-offset-4'
          }
        >
          {text}
        </Link>
      )}
    </p>
  );
}
