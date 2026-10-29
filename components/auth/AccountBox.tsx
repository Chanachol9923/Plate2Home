'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, buttonClass, Spinner } from '@/components/ui/Button';
import { inAppBrowser, lineExternalUrl } from '@/lib/client/inapp';
import { signIn, signOut, useSession } from '@/lib/client/session';

/**
 * Optional Google sign-in (D-085): what it gives (managing posts from any device), the
 * button, and once signed in, who you are and how to sign out. Never required to post.
 * Inside LINE, Facebook and the like, where Google refuses to sign in, it points to the
 * phone's browser instead (D-086).
 */
export function AccountBox({ context }: { context: 'post' | 'manage' }) {
  const t = useTranslations('account');
  const session = useSession();

  if (session.status === 'loading') return null;

  if (session.status === 'signed-in') {
    return (
      <div className="space-y-1 rounded-md border-2 border-line-soft bg-surface p-3">
        <p className="font-semibold">{t('signedInAs', { email: session.email ?? '' })}</p>
        <p className="text-sm text-ink-muted">{t('signedInNote')}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-ink underline decoration-2 underline-offset-4"
        >
          {t('signOut')}
        </button>
      </div>
    );
  }

  // Rendered only after the session check, so reading the browser here never hydrates.
  const inApp = inAppBrowser(navigator.userAgent);

  return (
    <div className="space-y-3 rounded-md border-2 border-line-soft bg-surface p-3">
      <p className="font-bold">{t('signInTitle')}</p>
      <p className="text-sm text-ink-muted">
        {t(context === 'post' ? 'signInBody' : 'signInBodyManage')}
      </p>
      {inApp ? (
        <>
          <p className="text-sm">{t('inAppBody')}</p>
          {inApp === 'line' ? (
            <a
              href={lineExternalUrl(window.location.href)}
              className={buttonClass('secondary', true)}
            >
              {t('inAppOpen')}
            </a>
          ) : (
            <p className="text-sm font-semibold">{t('inAppMenu')}</p>
          )}
        </>
      ) : (
        <SignInButton />
      )}
    </div>
  );
}

function SignInButton() {
  const t = useTranslations('account');
  const locale = useLocale();
  const [waiting, setWaiting] = useState(false);
  return (
    <>
      <Button variant="secondary" block onClick={() => setWaiting(signIn(locale))}>
        {t('signIn')}
      </Button>
      {waiting && (
        <p className="inline-flex items-center gap-2 text-sm" aria-live="polite">
          <Spinner /> {t('waiting')}
        </p>
      )}
    </>
  );
}
