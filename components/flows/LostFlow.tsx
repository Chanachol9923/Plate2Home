'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { ContactFields, EMPTY_CONTACT, type ContactDraft } from '@/components/forms/ContactFields';
import {
  errorsUnder,
  plateErrorsFrom,
  readDraft,
  useStep,
  writeDraft,
} from '@/components/forms/flow';
import { PinFields } from '@/components/forms/PinFields';
import { Turnstile, type TurnstileHandle } from '@/components/forms/Turnstile';
import { useErrorText } from '@/components/forms/useErrorText';
import { PlateInput, type PlateFieldErrors } from '@/components/plate/PlateInput';
import { PlateView } from '@/components/plate/PlateView';
import { FoundResults, type FoundResult } from '@/components/results/FoundResults';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClass } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Field';
import { Stepper } from '@/components/ui/Stepper';
import { Link } from '@/i18n/navigation';
import { CONSENT_VERSION } from '@/lib/config/app';
import { postJson } from '@/lib/client/api';
import { rememberDevicePost } from '@/lib/client/devices';
import { plateDisplay } from '@/lib/plate/canonical';
import { draftToInput, EMPTY_DRAFT, type PlateDraft } from '@/lib/plate/draft';
import { normalizePlate } from '@/lib/plate/normalize';
import { contactSchema, fieldErrors, pinSchema, plateInputSchema } from '@/lib/validation/schemas';

const STEPS = ['plate', 'contact', 'confirm'] as const;
type Step = (typeof STEPS)[number];
const DRAFT_KEY = 'p2h.draft.lost';

interface Created {
  deviceToken: string;
  batchId: string;
  matches: { matchId: string; kind: 'exact' | 'near' }[];
}

export function LostFlow() {
  const t = useTranslations('lost');
  const tc = useTranslations('common');
  const tConsent = useTranslations('consent');
  const errorText = useErrorText();
  const locale = useLocale() as 'th' | 'en';
  const [step, go] = useStep(STEPS);

  const [plate, setPlate] = useState<PlateDraft>(EMPTY_DRAFT);
  const [contact, setContact] = useState<ContactDraft>(EMPTY_CONTACT);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [consent, setConsent] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  const [plateErrors, setPlateErrors] = useState<PlateFieldErrors>({});
  const [contactErrors, setContactErrors] = useState<Record<string, string | null>>({});
  const [confirmErrors, setConfirmErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState<{
    for: string;
    results: FoundResult[];
    failed: boolean;
  } | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [restored, setRestored] = useState(false);

  // Restore the draft (never the PIN) after a reload or navigation.
  useEffect(() => {
    const saved = readDraft<{ plate: PlateDraft; contact: ContactDraft }>(DRAFT_KEY);
    // Ignore drafts saved by an older version of the form (different shape).
    if (saved && typeof saved.plate?.text === 'string') {
      // Syncing from an external store (sessionStorage) once after hydration; reading it during
      // render would make the server and client markup differ.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlate(saved.plate);
      setContact(saved.contact);
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (restored && !created) writeDraft(DRAFT_KEY, { plate, contact });
  }, [plate, contact, created, restored]);

  const plateInput = draftToInput(plate);
  const plateKey = JSON.stringify(plateInput);

  // Deep link or reload into a later step without a usable plate: start at step 1.
  const plateUsable = plateInputSchema.safeParse(plateInput).success;
  useEffect(() => {
    if (restored && step !== 'plate' && !created && !plateUsable) go('plate');
  }, [restored, step, created, plateUsable, go]);

  async function checkPlate() {
    setFormError(null);
    const parsed = plateInputSchema.safeParse(plateInput);
    if (!parsed.success) {
      setPlateErrors(plateErrorsFrom(fieldErrors(parsed.error), errorText));
      return;
    }
    setPlateErrors({});
    setBusy(true);
    const res = await postJson<{ results: FoundResult[] }>('/api/search', { plate: plateInput });
    setBusy(false);
    // A failed search must not block registering a watch (matching runs again on submit).
    const results = res.ok ? res.data.results : [];
    setSearch({ for: plateKey, results, failed: !res.ok });
    if (results.length === 0) go('contact');
  }

  function checkContact() {
    const parsed = contactSchema.safeParse(contact);
    if (!parsed.success) {
      const errs = errorsUnder(fieldErrors(parsed.error), '', errorText);
      if (errs.lineId && fieldErrors(parsed.error).lineId === 'contact_required') {
        setContactErrors({ contact: errs.lineId });
      } else setContactErrors(errs);
      return;
    }
    setContactErrors({});
    go('confirm');
  }

  async function submit() {
    setFormError(null);
    const errs: Record<string, string | null> = {};
    const pinParsed = pinSchema.safeParse(pin);
    if (!pinParsed.success) errs.pin = errorText(pinParsed.error.issues[0]?.message);
    else if (pin !== pinConfirm) errs.confirm = errorText('pin_mismatch');
    if (!consent) errs.consent = errorText('consent_required');
    if (!token) errs.turnstile = errorText('turnstile_required');
    setConfirmErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    const res = await postJson<Created>(
      '/api/lost',
      {
        plate: plateInput,
        contact,
        pin,
        consent: true,
        consentVersion: CONSENT_VERSION,
        locale,
        turnstileToken: token,
      },
      0, // Turnstile tokens are single-use: never auto-retry a write.
    );
    setBusy(false);
    turnstile.current?.reset();

    if (!res.ok) {
      if (res.code === 'invalid_input') {
        setPlateErrors(plateErrorsFrom(res.fields, errorText, 'plate.'));
        setContactErrors(errorsUnder(res.fields, 'contact.', errorText));
        setConfirmErrors({ pin: errorText(res.fields.pin) });
        setFormError(errorText('invalid'));
      } else {
        setFormError(errorText(res.code));
      }
      return;
    }

    rememberDevicePost({
      batchId: res.data.batchId,
      kind: 'lost',
      token: res.data.deviceToken,
      labels: [plateDisplay(normalizePlate(plateInput))],
      createdAt: new Date().toISOString(),
    });
    writeDraft(DRAFT_KEY, null);
    setPin('');
    setPinConfirm('');
    setCreated(res.data);
  }

  if (created) {
    return (
      <div className="space-y-5">
        <Alert tone="success" title={t('doneTitle')} live />
        <PlateView plate={normalizePlate(plateInput)} size="md" />
        {created.matches.length > 0 && (
          <Alert tone="highlight" title={t('doneMatches')}>
            <ul className="mt-2 space-y-2">
              {created.matches.map((m) => (
                <li key={m.matchId}>
                  <Link href={`/match/${m.matchId}`} className={buttonClass('primary')}>
                    {t('viewMatch')}
                  </Link>
                </li>
              ))}
            </ul>
          </Alert>
        )}
        <p className="text-ink-muted">{t('doneManage')}</p>
        <Link href="/" className={buttonClass('secondary')}>
          {tc('backHome')}
        </Link>
      </div>
    );
  }

  const index = STEPS.indexOf(step as Step) + 1;
  const searchedThis = search?.for === plateKey;

  return (
    <div>
      <Stepper
        current={index}
        total={STEPS.length}
        label={`${tc('step', { current: index, total: STEPS.length })} · ${t(`steps.${step}`)}`}
      />
      {formError && (
        <div className="mb-4">
          <Alert tone="error" title={formError} live />
        </div>
      )}

      {step === 'plate' && (
        <div className="space-y-5">
          <p>{t('plateIntro')}</p>
          <PlateInput value={plate} onChange={setPlate} errors={plateErrors} />
          {searchedThis && search.results.length > 0 ? (
            <div className="space-y-4">
              <Alert tone="highlight" title={t('foundAlready')} live>
                <p>{t('foundAlreadyBody')}</p>
              </Alert>
              <FoundResults results={search.results} />
              <Button block onClick={() => go('contact')}>
                {tc('next')}
              </Button>
            </div>
          ) : (
            <Button block busy={busy} busyLabel={t('checking')} onClick={checkPlate}>
              {tc('next')}
            </Button>
          )}
        </div>
      )}

      {step === 'contact' && (
        <div className="space-y-5">
          {searchedThis && !search.failed && search.results.length === 0 && (
            <Alert tone="info">{t('notFoundYet')}</Alert>
          )}
          <ContactFields value={contact} onChange={setContact} errors={contactErrors} />
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => go('plate')}>
              {tc('back')}
            </Button>
            <Button onClick={checkContact}>{tc('next')}</Button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-5">
          <PinFields
            pin={pin}
            confirm={pinConfirm}
            onChange={(p, c) => {
              setPin(p);
              setPinConfirm(c);
            }}
            errors={confirmErrors}
          />
          <Checkbox
            label={tConsent('label')}
            checked={consent}
            onChange={setConsent}
            error={confirmErrors.consent}
          />
          <div>
            <Turnstile ref={turnstile} action="lost_create" onToken={setToken} />
            {confirmErrors.turnstile && !token && (
              <p role="alert" className="text-sm font-semibold text-danger">
                {confirmErrors.turnstile}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => go('contact')}>
              {tc('back')}
            </Button>
            <Button busy={busy} busyLabel={tc('sending')} onClick={submit}>
              {t('submit')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
