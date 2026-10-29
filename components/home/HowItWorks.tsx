import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ArrowDownIcon, CameraIcon, CheckIcon, LostPlateIcon, PhoneIcon } from '@/components/icons';
import { PlateView } from '@/components/plate/PlateView';
import { plateDisplay } from '@/lib/plate/canonical';
import type { Plate } from '@/lib/plate/types';

/** One made-up plate followed through the whole story. */
const EXAMPLE: Plate = {
  type: 'car',
  prefixDigit: null,
  letters: 'กข',
  number: '1234',
  provinceCode: 'TH-10',
};

function Side({
  icon,
  title,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  action: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border-2 border-line-soft bg-surface p-3 text-center">
      <span className="text-ink">{icon}</span>
      <span>
        <span className="block font-heading font-bold">{title}</span>
        <span className="block text-sm text-ink-muted">{action}</span>
      </span>
      <span aria-hidden="true" className="mt-auto flex min-h-16 items-center">
        {children}
      </span>
    </div>
  );
}

function Down() {
  return (
    <div aria-hidden="true" className="flex justify-center py-1 text-ink-muted">
      <ArrowDownIcon size={28} />
    </div>
  );
}

/**
 * "How it works" as a picture (D-096): the owner types a plate, the finder photographs the
 * same plate, the two meet on that plate, then they contact each other. The drawings are
 * decorative; the titles carry the meaning for screen readers.
 */
export function HowItWorks() {
  const t = useTranslations('home.how');
  const typed = plateDisplay(EXAMPLE).replace(' ', '');

  return (
    <section aria-labelledby="how-title" className="mt-10 border-t-2 border-line-soft pt-6">
      <h2 id="how-title" className="text-lg font-bold">
        {t('title')}
      </h2>
      <ol className="mt-4">
        <li className="grid grid-cols-2 gap-3">
          <Side icon={<LostPlateIcon size={36} />} title={t('lostTitle')} action={t('lostDo')}>
            {/* A plate number being typed, caret and all. */}
            <span className="inline-flex items-center border-b-2 border-line px-1 font-heading text-xl font-bold">
              {typed}
              <span className="ml-0.5 inline-block h-6 w-0.5 bg-ink motion-safe:animate-pulse" />
            </span>
          </Side>
          <Side icon={<CameraIcon size={36} />} title={t('foundTitle')} action={t('foundDo')}>
            {/* The same plate seen through a viewfinder. */}
            <span className="rounded-md border-2 border-dashed border-line p-1">
              <PlateView plate={EXAMPLE} size="xs" />
            </span>
          </Side>
        </li>
        <li>
          <Down />
          <div className="flex flex-col items-center gap-2 rounded-md border-2 border-line bg-accent-soft p-4 text-center">
            <span aria-hidden="true">
              <PlateView plate={EXAMPLE} size="sm" />
            </span>
            <span className="inline-flex items-center gap-2 font-heading text-lg font-bold">
              <CheckIcon size={26} />
              {t('matchTitle')}
            </span>
            <span className="text-sm">{t('matchDo')}</span>
          </div>
        </li>
        <li>
          <Down />
          <div className="flex items-center gap-3 rounded-md border-2 border-line-soft bg-surface p-3">
            <span aria-hidden="true" className="flex shrink-0 text-ink">
              <PhoneIcon size={32} />
              <PhoneIcon size={32} className="-ml-2" />
            </span>
            <span>
              <span className="block font-heading font-bold">{t('contactTitle')}</span>
              <span className="block text-sm text-ink-muted">{t('contactDo')}</span>
            </span>
          </div>
        </li>
      </ol>
    </section>
  );
}
