'use client';

import { useTranslations } from 'next-intl';
import { useState, useSyncExternalStore } from 'react';
import { useErrorText } from '@/components/forms/useErrorText';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { postJson } from '@/lib/client/api';
import { readDevicePosts } from '@/lib/client/devices';
import { ContactCard } from './ContactCard';
import { RevealContact } from './RevealContact';

interface OwnerContact {
  lineId: string | null;
  phone: string | null;
  email: string | null;
}

const noSubscribe = () => () => {};

/**
 * Contact on the match page depends on who is looking, which only this device knows (from
 * the device tokens stored when posting):
 *  - the finder (holds the found batch token) sees the owner's contact (D-002);
 *  - everyone else (normally the owner) goes through the finder-contact reveal.
 */
export function MatchContact({
  matchId,
  foundPostId,
  foundBatchId,
  lostBatchId,
}: {
  matchId: string;
  foundPostId: string;
  foundBatchId: string;
  lostBatchId: string;
}) {
  const t = useTranslations('match');
  const tc = useTranslations('common');
  const errorText = useErrorText();
  // Read on the client only; the server render shows the default (owner) view.
  const finderToken = useSyncExternalStore(
    noSubscribe,
    () => readDevicePosts().find((d) => d.batchId === foundBatchId)?.token ?? null,
    () => null,
  );
  const isOwner = useSyncExternalStore(
    noSubscribe,
    () => readDevicePosts().some((d) => d.batchId === lostBatchId),
    () => false,
  );
  const [contact, setContact] = useState<OwnerContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (finderToken) {
    if (contact) {
      return (
        <ContactCard
          title={t('ownerContactTitle')}
          reminder={t('finderReminder')}
          lineId={contact.lineId}
          phone={contact.phone}
          email={contact.email}
        />
      );
    }
    return (
      <div className="space-y-3">
        <Alert tone="highlight" title={t('youAreFinder')}>
          <p>{t('finderBody')}</p>
        </Alert>
        {error && <Alert tone="error" title={error} live />}
        <Button
          block
          busy={busy}
          busyLabel={tc('sending')}
          onClick={async () => {
            setError(null);
            setBusy(true);
            const res = await postJson<{ contact: OwnerContact }>(
              '/api/reveal-owner',
              { matchId, token: finderToken },
              0,
            );
            setBusy(false);
            if (res.ok) setContact(res.data.contact);
            else setError(errorText(res.code));
          }}
        >
          {t('ownerContactButton')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isOwner && <p className="font-semibold">{t('youAreOwner')}</p>}
      <RevealContact postId={foundPostId} />
    </div>
  );
}
