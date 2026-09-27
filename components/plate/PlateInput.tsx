'use client';

import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { Choice } from '@/components/ui/Choice';
import { headerControl } from '@/components/ui/styles';
import type { PlateDraft } from '@/lib/plate/draft';
import { provinceName } from '@/lib/plate/provinces';
import type { PlateType } from '@/lib/plate/types';
import { ConsonantSheet } from './ConsonantSheet';
import { PlateFrame } from './PlateView';
import { ProvinceSheet } from './ProvinceSheet';

export type PlateFieldErrors = Partial<Record<'series' | 'number' | 'provinceCode', string | null>>;

const fieldClass =
  'block w-full min-w-0 rounded-sm border-b-2 border-dashed border-plate-ink/40 bg-transparent text-center font-bold ' +
  'text-plate-ink placeholder:text-plate-ink/25 focus:border-solid focus:border-plate-ink';

/**
 * The signature component: a plate-shaped input. Each zone is a real <input> with the right
 * keyboard (Thai text for letters, numeric for the number); the province opens a searchable
 * sheet. `?` marks unreadable characters (a button adds it, since numeric keyboards lack it).
 */
export function PlateInput({
  value,
  onChange,
  errors = {},
}: {
  value: PlateDraft;
  onChange: (draft: PlateDraft) => void;
  errors?: PlateFieldErrors;
}) {
  const t = useTranslations('plate');
  const id = useId();
  const seriesRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const lastField = useRef<'series' | 'number'>('series');
  const [provinceOpen, setProvinceOpen] = useState(false);
  const [lettersOpen, setLettersOpen] = useState(false);

  const set = (patch: Partial<PlateDraft>) => onChange({ ...value, ...patch });
  const province = provinceName(value.provinceCode, 'th');
  const errorIds = (['series', 'number', 'provinceCode'] as const)
    .filter((f) => errors[f])
    .map((f) => `${id}-${f}-error`);

  const insertWildcard = () => {
    const field = lastField.current;
    set({ [field]: `${value[field]}?` });
    (field === 'series' ? seriesRef : numberRef).current?.focus();
  };

  const series = (
    <input
      ref={seriesRef}
      value={value.series}
      onChange={(e) => set({ series: e.target.value })}
      onFocus={() => (lastField.current = 'series')}
      aria-label={t('seriesLabel')}
      aria-invalid={Boolean(errors.series) || undefined}
      aria-describedby={`${id}-instructions ${errors.series ? `${id}-series-error` : ''}`.trim()}
      placeholder={t('seriesPlaceholder')}
      lang="th"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      maxLength={6}
      className={`${fieldClass} ${value.type === 'motorcycle' ? 'text-[2.2rem]' : 'text-[2.6rem]'}`}
    />
  );

  const number = (
    <input
      ref={numberRef}
      value={value.number}
      onChange={(e) => set({ number: e.target.value })}
      onFocus={() => (lastField.current = 'number')}
      aria-label={t('numberLabel')}
      aria-invalid={Boolean(errors.number) || undefined}
      aria-describedby={`${id}-instructions ${errors.number ? `${id}-number-error` : ''}`.trim()}
      placeholder={t('numberPlaceholder')}
      inputMode="numeric"
      autoComplete="off"
      maxLength={6}
      className={`${fieldClass} text-[2.6rem]`}
    />
  );

  const provinceButton = (
    <button
      type="button"
      onClick={() => setProvinceOpen(true)}
      aria-label={`${t('provinceLabel')}: ${province ?? t('provinceChoose')}`}
      aria-describedby={errors.provinceCode ? `${id}-provinceCode-error` : undefined}
      className="mt-0.5 block min-h-11 w-full rounded-sm border-b-2 border-dashed border-plate-ink/40 text-lg font-semibold"
    >
      <span lang="th" className={province ? '' : 'text-plate-ink/45'}>
        {province ?? t('provinceChoose')}
      </span>
    </button>
  );

  return (
    <div className="space-y-3">
      <Choice<PlateType>
        legend={t('typeLegend')}
        value={value.type}
        onChange={(type) => set({ type })}
        options={[
          { value: 'car', label: t('car') },
          { value: 'motorcycle', label: t('motorcycle') },
          { value: 'other', label: t('other') },
        ]}
      />

      <p id={`${id}-instructions`} className="text-sm text-ink-muted">
        {t('instructions')}
      </p>

      <PlateFrame size="lg" className="mx-auto">
        {value.type === 'motorcycle' ? (
          <div className="mx-auto max-w-[12rem] space-y-0.5 py-1">
            {series}
            {provinceButton}
            {number}
          </div>
        ) : (
          <div className="py-1">
            <div className="flex items-end gap-2">
              <div className="w-[42%]">{series}</div>
              <div className="flex-1">{number}</div>
            </div>
            {provinceButton}
          </div>
        )}
      </PlateFrame>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={headerControl}
          onClick={() => setLettersOpen(true)}
          aria-label={t('lettersButtonLabel')}
        >
          {t('lettersButton')}
        </button>
        <button
          type="button"
          className={headerControl}
          onClick={insertWildcard}
          aria-label={t('wildcardButtonLabel')}
        >
          {t('wildcardButton')}
        </button>
        <p className="flex-1 text-sm text-ink-muted">{t('wildcardHint')}</p>
      </div>

      {errorIds.length > 0 && (
        <div className="space-y-1">
          {(['series', 'number', 'provinceCode'] as const).map((f) =>
            errors[f] ? (
              <p
                key={f}
                id={`${id}-${f}-error`}
                role="alert"
                className="text-sm font-semibold text-danger"
              >
                {errors[f]}
              </p>
            ) : null,
          )}
        </div>
      )}

      <ProvinceSheet
        open={provinceOpen}
        onClose={() => setProvinceOpen(false)}
        onSelect={(provinceCode) => set({ provinceCode })}
      />
      <ConsonantSheet
        open={lettersOpen}
        onClose={() => {
          setLettersOpen(false);
          seriesRef.current?.focus();
        }}
        onPick={(ch) => set({ series: `${value.series}${ch}` })}
        onDelete={() => set({ series: [...value.series].slice(0, -1).join('') })}
      />
    </div>
  );
}
