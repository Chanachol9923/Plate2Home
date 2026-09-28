'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Turnstile, type TurnstileHandle } from '@/components/forms/Turnstile';
import { useErrorText } from '@/components/forms/useErrorText';
import { PostCard, type OwnPost, type PostAction } from '@/components/manage/PostCard';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Field, TextInput } from '@/components/ui/Field';
import { Link } from '@/i18n/navigation';
import { postJson } from '@/lib/client/api';
import { forgetDevicePost } from '@/lib/client/devices';
import { draftToInput, EMPTY_DRAFT, splitPlateText, type PlateDraft } from '@/lib/plate/draft';
import { fieldErrors, plateInputSchema } from '@/lib/validation/schemas';

/**
 * Manage a post from any device (D-078): a plate number from the post plus its PIN opens it;
 * then the owner can mark the plate as returned, extend or delete. The plate and PIN stay in
 * memory for the follow-up actions and are never stored.
 */
export function ManagePanel() {
  const t = useTranslations('manage');
  const tMine = useTranslations('myPosts');
  const tPin = useTranslations('pin');
  const tPlate = useTranslations('plate');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  const [plate, setPlate] = useState<PlateDraft>(EMPTY_DRAFT);
  const [plateError, setPlateError] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [shown, setShown] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [posts, setPosts] = useState<OwnPost[] | null>(null);

  const auth = () => ({ kind: 'pin' as const, plate: draftToInput(plate), pin });

  async function open() {
    setError(null);
    const parsed = plateInputSchema.safeParse(draftToInput(plate));
    if (!parsed.success) {
      setPlateError(errorText(Object.values(fieldErrors(parsed.error))[0] ?? 'invalid'));
      return;
    }
    setPlateError(null);
    if (!/^\d{4,6}$/.test(pin)) {
      setError(errorText('pin_format'));
      return;
    }
    if (!token) {
      setError(errorText('turnstile_required'));
      return;
    }
    setBusy('open');
    const res = await postJson<{ posts: OwnPost[] }>(
      '/api/manage',
      { auth: { ...auth(), turnstileToken: token }, action: 'list' },
      0,
    );
    setBusy(null);
    turnstile.current?.reset();
    setToken(null);
    if (!res.ok) {
      setError(errorText(res.code));
      return;
    }
    setPosts(res.data.posts);
  }

  async function act(post: OwnPost, action: PostAction) {
    setBusy(post.postId);
    setError(null);
    setNotice(null);
    const res = await postJson<{ posts: OwnPost[] }>(
      '/api/manage',
      { auth: auth(), action, postId: post.postId },
      0,
    );
    setBusy(null);
    if (!res.ok) {
      setError(errorText(res.code));
      return;
    }
    if (res.data.posts.length === 0) forgetDevicePost(post.batchId);
    setPosts(res.data.posts);
    setNotice(tMine(`done.${action}`));
  }

  if (posts) {
    return (
      <div className="space-y-4">
        {notice && <Alert tone="success" title={notice} live />}
        {error && <Alert tone="error" title={error} live />}
        {posts.length === 0 ? (
          <Alert tone="info" title={t('allDeleted')} />
        ) : (
          <>
            <p className="text-ink-muted">{t('found', { count: posts.length })}</p>
            <ul className="space-y-3">
              {posts.map((p) => (
                <PostCard
                  key={p.postId}
                  post={p}
                  busy={busy === p.postId}
                  onAction={(a) => void act(p, a)}
                />
              ))}
            </ul>
          </>
        )}
        <Button
          variant="secondary"
          onClick={() => {
            setPosts(null);
            setPin('');
            setNotice(null);
          }}
        >
          {t('another')}
        </Button>
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        void open();
      }}
    >
      <p>{t('intro')}</p>
      {/* Only the letters and number identify the post; province and type don't matter here. */}
      <Field label={tPlate('textLabel')} hint={t('plateHint')} error={plateError}>
        {({ inputId, describedBy, invalid }) => (
          <TextInput
            id={inputId}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={plate.text}
            onChange={(e) => setPlate({ ...plate, text: e.target.value })}
            placeholder={tPlate('textPlaceholder')}
            lang="th"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={12}
            className="max-w-[16rem] text-xl font-bold"
          />
        )}
      </Field>
      {plate.text.trim() && (
        <p className="-mt-3 text-sm text-ink-muted">
          {tPlate('parsed', {
            series: splitPlateText(plate.text, plate.type).series || '—',
            number: splitPlateText(plate.text, plate.type).number || '—',
          })}
        </p>
      )}
      <Field label={t('pinLabel')} hint={t('pinHint')}>
        {({ inputId, describedBy }) => (
          <div className="flex items-center gap-2">
            <TextInput
              id={inputId}
              aria-describedby={describedBy}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              type={shown ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              className="max-w-[12rem] tracking-[0.4em]"
            />
            <button
              type="button"
              onClick={() => setShown((s) => !s)}
              aria-pressed={shown}
              className="min-h-11 px-2 text-sm font-semibold underline decoration-2 underline-offset-4"
            >
              {shown ? tPin('hide') : tPin('show')}
            </button>
          </div>
        )}
      </Field>
      <Turnstile ref={turnstile} action="manage" onToken={setToken} />
      {error && <Alert tone="error" title={error} live />}
      <Button type="submit" block busy={busy === 'open'} busyLabel={tc('sending')}>
        {t('open')}
      </Button>
      <p className="text-sm text-ink-muted">
        {t('forgot')}{' '}
        <Link href="/about#contact" className="font-semibold underline underline-offset-4">
          {t('contactUs')}
        </Link>
      </p>
    </form>
  );
}
