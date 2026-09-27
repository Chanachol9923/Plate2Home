'use client';

import { useTranslations } from 'next-intl';
import { Field, TextInput } from '@/components/ui/Field';

/** PIN + confirmation. Digits only, numeric keyboard, never autofilled or persisted. */
export function PinFields({
  pin,
  confirm,
  onChange,
  errors,
}: {
  pin: string;
  confirm: string;
  onChange: (pin: string, confirm: string) => void;
  errors: { pin?: string | null; confirm?: string | null };
}) {
  const t = useTranslations('pin');
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 6);
  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-bold">{t('title')}</legend>
      <p className="text-ink-muted">{t('intro')}</p>
      <Field label={t('label')} hint={t('hint')} error={errors.pin}>
        {({ inputId, describedBy, invalid }) => (
          <TextInput
            id={inputId}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={pin}
            onChange={(e) => onChange(digits(e.target.value), confirm)}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            className="max-w-[12rem] tracking-[0.4em]"
          />
        )}
      </Field>
      <Field label={t('confirm')} error={errors.confirm}>
        {({ inputId, describedBy, invalid }) => (
          <TextInput
            id={inputId}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            value={confirm}
            onChange={(e) => onChange(pin, digits(e.target.value))}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            className="max-w-[12rem] tracking-[0.4em]"
          />
        )}
      </Field>
    </fieldset>
  );
}
