'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { plateErrorsFrom } from '@/components/forms/flow';
import { useErrorText } from '@/components/forms/useErrorText';
import { PlateInput, type PlateFieldErrors } from '@/components/plate/PlateInput';
import { FoundResults, type FoundResult } from '@/components/results/FoundResults';
import { Alert } from '@/components/ui/Alert';
import { Button, buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { postJson } from '@/lib/client/api';
import { draftToInput, EMPTY_DRAFT, type PlateDraft } from '@/lib/plate/draft';
import { fieldErrors, plateInputSchema } from '@/lib/validation/schemas';

/** Search found plates. No browsable list: results only for an entered plate (spec §3.4). */
export function SearchPanel() {
  const t = useTranslations('search');
  const errorText = useErrorText();
  const [plate, setPlate] = useState<PlateDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<PlateFieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<FoundResult[] | null>(null);

  async function search() {
    setError(null);
    const input = draftToInput(plate);
    const parsed = plateInputSchema.safeParse(input);
    if (!parsed.success) {
      setErrors(plateErrorsFrom(fieldErrors(parsed.error), errorText));
      return;
    }
    setErrors({});
    setBusy(true);
    const res = await postJson<{ results: FoundResult[] }>('/api/search', { plate: input });
    setBusy(false);
    if (!res.ok) {
      setError(errorText(res.code));
      return;
    }
    setResults(res.data.results);
  }

  return (
    <div className="space-y-5">
      <p>{t('intro')}</p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <PlateInput value={plate} onChange={setPlate} errors={errors} />
        <Button type="submit" block busy={busy} busyLabel={t('searching')}>
          {t('submit')}
        </Button>
      </form>

      {error && <Alert tone="error" title={error} live />}

      {results && (
        <section aria-live="polite" className="space-y-3">
          {results.length === 0 ? (
            <Alert tone="info" title={t('none')}>
              <p>{t('noneBody')}</p>
              <Link href="/lost" className={`${buttonClass('primary')} mt-3`}>
                {t('reportLost')}
              </Link>
            </Alert>
          ) : (
            <>
              <h2 className="font-bold">{t('resultsCount', { count: results.length })}</h2>
              <FoundResults results={results} />
              <p className="text-sm text-ink-muted">{t('contactNext')}</p>
            </>
          )}
        </section>
      )}
    </div>
  );
}
