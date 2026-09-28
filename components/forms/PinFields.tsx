'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Field, TextInput } from '@/components/ui/Field';

/**
 * One PIN field with show/hide (no retyping: seeing it prevents typos). Digits only, numeric
 * keyboard, never autofilled or stored. It says what the PIN is for: managing the post from
 * any device with the plate number (D-078).
 */
export function PinFields({
  pin,
  onChange,
  error,
}: {
  pin: string;
  onChange: (pin: string) => void;
  error?: string | null;
}) {
  const t = useTranslations('pin');
  const [shown, setShown] = useState(false);
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);
  return (
    <fieldset className="space-y-3">
      <legend className="text-lg font-bold">{t('title')}</legend>
      <p className="text-ink-muted">{t('intro')}</p>
      <Field label={t('label')} hint={t('hint')} error={error}>
        {({ inputId, describedBy, invalid }) => (
          <div className="flex items-center gap-2">
            <TextInput
              id={inputId}
              aria-describedby={describedBy}
              aria-invalid={invalid || undefined}
              value={pin}
              onChange={(e) => onChange(digits(e.target.value))}
              type={shown ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="new-password"
              className="max-w-[12rem] tracking-[0.4em]"
            />
            <button
              type="button"
              onClick={() => setShown((s) => !s)}
              aria-pressed={shown}
              className="min-h-11 px-2 text-sm font-semibold underline decoration-2 underline-offset-4"
            >
              {shown ? t('hide') : t('show')}
            </button>
          </div>
        )}
      </Field>
    </fieldset>
  );
}
