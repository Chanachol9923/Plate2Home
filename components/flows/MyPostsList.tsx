'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useErrorText } from '@/components/forms/useErrorText';
import { PostCard, type OwnPost, type PostAction } from '@/components/manage/PostCard';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClass, Spinner } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { postJson } from '@/lib/client/api';
import { forgetDevicePost, readDevicePosts } from '@/lib/client/devices';

type State =
  | { phase: 'loading' }
  | { phase: 'empty' }
  | { phase: 'error'; message: string | null }
  | { phase: 'ready'; posts: OwnPost[] };

/**
 * Posts created on this device (device tokens in localStorage), their matches, and the owner's
 * actions (D-078). Posts from other devices are managed with plate + PIN on /manage.
 */
export function MyPostsList() {
  const t = useTranslations('myPosts');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const devices = readDevicePosts().map((d) => ({ batchId: d.batchId, token: d.token }));
    const load = async () => {
      if (devices.length === 0) return { phase: 'empty' } as const;
      const res = await postJson<{ posts: OwnPost[] }>('/api/my-posts', { devices });
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

  async function act(post: OwnPost, action: PostAction) {
    const device = readDevicePosts().find((d) => d.batchId === post.batchId);
    if (!device || state.phase !== 'ready') return;
    setBusy(post.postId);
    setNotice(null);
    const res = await postJson<{ posts: OwnPost[] }>(
      '/api/manage',
      {
        auth: { kind: 'device', batchId: post.batchId, token: device.token },
        action,
        postId: post.postId,
      },
      0,
    );
    setBusy(null);
    if (!res.ok) {
      setNotice({ tone: 'error', text: errorText(res.code) ?? '' });
      return;
    }
    if (res.data.posts.length === 0) forgetDevicePost(post.batchId);
    const others = state.posts.filter((p) => p.batchId !== post.batchId);
    const posts = [...res.data.posts, ...others].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
    setState(posts.length ? { phase: 'ready', posts } : { phase: 'empty' });
    setNotice({ tone: 'success', text: t(`done.${action}`) });
  }

  const manageLink = (
    <p className="text-sm">
      {t('otherDevices')}{' '}
      <Link href="/manage" className="font-semibold underline underline-offset-4">
        {t('manageWithPin')}
      </Link>
    </p>
  );

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
      <div className="space-y-4">
        <Alert tone="info" title={t('empty')}>
          <p>{t('emptyBody')}</p>
        </Alert>
        {notice && <Alert tone={notice.tone} title={notice.text} live />}
        <Link href="/manage" className={buttonClass('secondary')}>
          {t('manageWithPin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-ink-muted">{t('intro')}</p>
      {notice && <Alert tone={notice.tone} title={notice.text} live />}
      <ul className="space-y-3">
        {state.posts.map((p) => (
          <PostCard
            key={p.postId}
            post={p}
            busy={busy === p.postId}
            onAction={(a) => void act(p, a)}
          />
        ))}
      </ul>
      {manageLink}
    </div>
  );
}
