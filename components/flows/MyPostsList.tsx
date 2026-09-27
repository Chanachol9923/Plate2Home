'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useErrorText } from '@/components/forms/useErrorText';
import { PlateView } from '@/components/plate/PlateView';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClass, Spinner } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { postJson } from '@/lib/client/api';
import { readDevicePosts } from '@/lib/client/devices';
import type { Plate } from '@/lib/plate/types';

interface MyPost {
  batchId: string;
  postId: string;
  kind: 'lost' | 'found';
  plate: Plate;
  status: 'active' | 'needs_review' | 'hidden' | 'resolved';
  createdAt: string;
  expiresAt: string;
  matches: { matchId: string; kind: 'exact' | 'near'; createdAt: string }[];
}

type State =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'error'; message: string | null }
  | { phase: 'ready'; posts: MyPost[] };

/** Posts created on this device (device tokens in localStorage) and their matches. */
export function MyPostsList() {
  const t = useTranslations('myPosts');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const format = useFormatter();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const devices = readDevicePosts().map((d) => ({ batchId: d.batchId, token: d.token }));
    const load = async () => {
      if (devices.length === 0) return { phase: 'empty' } as const;
      const res = await postJson<{ posts: MyPost[] }>('/api/my-posts', { devices });
      if (!res.ok) return { phase: 'error', message: errorText(res.code) } as const;
      return res.data.posts.length === 0
        ? ({ phase: 'empty' } as const)
        : ({ phase: 'ready', posts: res.data.posts } as const);
    };
    void load().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt, errorText]);

  if (state.phase === 'loading') {
    return (
      <p className="inline-flex items-center gap-2" aria-live="polite">
        <Spinner /> {t('loading')}
      </p>
    );
  }
  if (state.phase === 'error') {
    return (
      <div className="space-y-3">
        <Alert tone="error" title={state.message ?? ''} live />
        <Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
          {tc('retry')}
        </Button>
      </div>
    );
  }
  if (state.phase === 'empty') {
    return (
      <Alert tone="info" title={t('empty')}>
        <p>{t('emptyBody')}</p>
      </Alert>
    );
  }

  const now = new Date();
  return (
    <div className="space-y-4">
      <p className="text-ink-muted">{t('intro')}</p>
      <ul className="space-y-3">
        {state.posts.map((p) => (
          <li key={p.postId} className="space-y-3 rounded-md border-2 border-line bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-sm px-2 py-0.5 text-sm font-bold ${
                  p.kind === 'lost' ? 'bg-accent text-on-accent' : 'border-2 border-line'
                }`}
              >
                {p.kind === 'lost' ? t('lost') : t('found')}
              </span>
              <span className="text-sm text-ink-muted">
                {t('posted', { when: format.relativeTime(new Date(p.createdAt), now) })}
                {' · '}
                {t('expires', { when: format.relativeTime(new Date(p.expiresAt), now) })}
              </span>
            </div>
            <PlateView plate={p.plate} size="sm" />
            {p.status === 'needs_review' && <p className="text-sm">{t('needsReview')}</p>}
            {p.status === 'hidden' && <p className="text-sm text-danger">{t('hidden')}</p>}
            {p.matches.length === 0 ? (
              <p className="text-sm text-ink-muted">{t('noMatches')}</p>
            ) : (
              <div className="space-y-2">
                <p className="font-semibold">{t('matches', { count: p.matches.length })}</p>
                {p.matches.map((m) => (
                  <Link
                    key={m.matchId}
                    href={`/match/${m.matchId}`}
                    className={buttonClass('primary', true)}
                  >
                    {t('viewMatch')}
                  </Link>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-muted">{t('otherDevices')}</p>
    </div>
  );
}
