'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { Turnstile, type TurnstileHandle } from '@/components/forms/Turnstile';
import { useErrorText } from '@/components/forms/useErrorText';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClass } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { postJson } from '@/lib/client/api';

interface Contact {
  lineId: string | null;
  phone: string | null;
  email: string | null;
  handover: 'with_finder' | 'police_station' | null;
  policeStationNote: string | null;
  district: string | null;
  note: string | null;
}

/** LINE add-friend link: personal IDs use `~id`, official accounts start with `@`. */
function lineUrl(id: string): string {
  return id.startsWith('@')
    ? `https://line.me/R/ti/p/${encodeURIComponent(id)}`
    : `https://line.me/ti/p/~${encodeURIComponent(id)}`;
}

function CopyButton({ value }: { value: string }) {
  const t = useTranslations('reveal');
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="min-h-11 px-2 text-sm font-semibold text-accent-ink underline decoration-2 underline-offset-4"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard blocked: the value is visible and selectable anyway.
        }
      }}
    >
      <span aria-live="polite">{copied ? t('copied') : t('copy')}</span>
    </button>
  );
}

/**
 * The anti-scam checkpoint (spec §3.5): the safety advice must be acknowledged and Turnstile
 * passed before the finder's contact is fetched. Every reveal is logged server-side.
 */
export function RevealContact({ postId }: { postId: string }) {
  const t = useTranslations('reveal');
  const tc = useTranslations('common');
  const tn = useTranslations('note');
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [ack, setAck] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  async function reveal() {
    setError(null);
    if (!ack) {
      setError(errorText('consent_required'));
      return;
    }
    if (!token) {
      setError(errorText('turnstile_required'));
      return;
    }
    setBusy(true);
    const res = await postJson<{ contact: Contact }>(
      '/api/reveal',
      { postId, acknowledged: true, turnstileToken: token },
      0,
    );
    setBusy(false);
    turnstile.current?.reset();
    if (!res.ok) {
      setError(errorText(res.code));
      return;
    }
    setContact(res.data.contact);
    setOpen(false);
  }

  if (contact) {
    const row = 'flex flex-wrap items-center justify-between gap-2 py-2';
    return (
      <section
        aria-live="polite"
        className="space-y-2 rounded-md border-2 border-line bg-accent-soft p-4"
      >
        <h3 className="font-heading text-lg font-bold">{t('contactTitle')}</h3>
        <dl className="divide-y-2 divide-line-soft">
          {contact.lineId && (
            <div className={row}>
              <dt className="font-semibold">{t('line')}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg">{contact.lineId}</span>
                <CopyButton value={contact.lineId} />
                <a
                  href={lineUrl(contact.lineId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass('secondary')}
                >
                  {t('openLine')}
                </a>
              </dd>
            </div>
          )}
          {contact.phone && (
            <div className={row}>
              <dt className="font-semibold">{t('phone')}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-lg">{contact.phone}</span>
                <CopyButton value={contact.phone} />
                <a href={`tel:${contact.phone}`} className={buttonClass('secondary')}>
                  {t('call')}
                </a>
              </dd>
            </div>
          )}
          {contact.email && (
            <div className={row}>
              <dt className="font-semibold">{t('email')}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="break-all">{contact.email}</span>
                <a href={`mailto:${contact.email}`} className={buttonClass('secondary')}>
                  {t('sendEmail')}
                </a>
              </dd>
            </div>
          )}
          {contact.district && (
            <div className={row}>
              <dt className="font-semibold">{t('district')}</dt>
              <dd>{contact.district}</dd>
            </div>
          )}
        </dl>
        {contact.note && (
          <div>
            <p className="font-semibold">{tn('finderNote')}</p>
            <p className="whitespace-pre-line">{contact.note}</p>
          </div>
        )}
        {contact.handover && (
          <p>
            {contact.handover === 'police_station'
              ? t('atPolice', { station: contact.policeStationNote ?? '' })
              : t('withFinder')}
          </p>
        )}
        <p className="font-semibold text-danger">{t('reminder')}</p>
      </section>
    );
  }

  return (
    <>
      <Button block onClick={() => setOpen(true)}>
        {t('button')}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('sheetTitle')}
        closeLabel={tc('close')}
      >
        <div className="space-y-4">
          <p>{t('intro')}</p>
          <ol className="list-decimal space-y-2 ps-6">
            <li className="font-semibold">{t('tip1')}</li>
            <li>{t('tip2')}</li>
            <li>{t('tip3')}</li>
            <li>{t('tip4')}</li>
          </ol>
          <Checkbox label={t('acknowledge')} checked={ack} onChange={setAck} />
          {open && <Turnstile ref={turnstile} action="reveal" onToken={setToken} />}
          {error && <Alert tone="error" title={error} live />}
          <Button block busy={busy} busyLabel={tc('sending')} onClick={reveal}>
            {t('confirm')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
