import type { Metadata } from 'next';
import { getFormatter, getTranslations } from 'next-intl/server';
import { PageShell } from '@/components/site/PageShell';
import { POST_TTL_DAYS } from '@/lib/config/app';
import { brand } from '@/lib/config/brand';

/** Date shown as "last updated" for the terms and privacy sections. LEGAL-TODO(terms). */
const UPDATED = new Date('2026-09-28T00:00:00+07:00');

const SECTIONS = ['how', 'terms', 'privacy', 'contact'] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('about');
  return { title: t('title', { brand: brand.name.en }) };
}

// LEGAL-TODO(terms), LEGAL-TODO(data-controller), LEGAL-TODO(retention): the terms and privacy
// text below are plain-language drafts to be reviewed by a Thai lawyer (docs/legal-todo.md).
export default async function AboutPage() {
  const t = await getTranslations('about');
  const tFooter = await getTranslations('footer');
  const format = await getFormatter();
  const vars = { brand: brand.name.en, days: POST_TTL_DAYS };

  // Lists are message objects walked by key, so the keys are only known at runtime.
  const tAny = t as unknown as ((key: string, values?: typeof vars) => string) & {
    raw: (key: string) => unknown;
  };

  /** A list whose items are the keys of a message object (so each item can use {brand}). */
  const list = (key: string, ordered = false) => {
    const keys = Object.keys(tAny.raw(key) as Record<string, string>);
    const Tag = ordered ? 'ol' : 'ul';
    return (
      <Tag className={`space-y-1.5 pl-6 ${ordered ? 'list-decimal' : 'list-disc'}`}>
        {keys.map((k) => (
          <li key={k}>{tAny(`${key}.${k}`, vars)}</li>
        ))}
      </Tag>
    );
  };
  const h2 = 'scroll-mt-4 pt-2 text-xl font-bold';
  const h3 = 'font-heading font-bold';

  return (
    <PageShell title={t('title', vars)}>
      <div className="space-y-8">
        <p className="text-lg">{t('lead', vars)}</p>

        <nav aria-label={t('tocLabel')} className="rounded-md border-2 border-line-soft p-3">
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {SECTIONS.map((s) => (
              <li key={s}>
                <a href={`#${s}`} className="font-semibold underline underline-offset-4">
                  {t(`${s}.title`)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="how" className="space-y-4">
          <h2 id="how" className={h2}>
            {t('how.title')}
          </h2>
          <h3 className={h3}>{t('how.ownerTitle')}</h3>
          {list('how.owner', true)}
          <h3 className={h3}>{t('how.finderTitle')}</h3>
          {list('how.finder', true)}
          <h3 className={h3}>{t('how.handoverTitle')}</h3>
          {list('how.handover')}
        </section>

        <section aria-labelledby="terms" className="space-y-4">
          <h2 id="terms" className={h2}>
            {t('terms.title')}
          </h2>
          <p className="text-sm text-ink-muted">
            {t('updated', { date: format.dateTime(UPDATED, { dateStyle: 'long' }) })}
          </p>
          {list('terms.items', true)}
        </section>

        <section aria-labelledby="privacy" className="space-y-4">
          <h2 id="privacy" className={h2}>
            {t('privacy.title')}
          </h2>
          <h3 className={h3}>{t('privacy.collectTitle')}</h3>
          {list('privacy.collect')}
          <h3 className={h3}>{t('privacy.notTitle')}</h3>
          {list('privacy.not')}
          <h3 className={h3}>{t('privacy.shareTitle')}</h3>
          {list('privacy.share')}
          <h3 className={h3}>{t('privacy.keepTitle')}</h3>
          <p>{t('privacy.keep', vars)}</p>
        </section>

        <section aria-labelledby="contact" className="space-y-3">
          <h2 id="contact" className={h2}>
            {t('contact.title')}
          </h2>
          <dl className="space-y-2">
            <div>
              <dt className="font-semibold">{t('contact.email')}</dt>
              <dd>
                <a
                  href={`mailto:${brand.contactEmail}`}
                  className="break-all underline underline-offset-4"
                >
                  {brand.contactEmail}
                </a>
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{t('contact.repo')}</dt>
              <dd>
                <a
                  href={brand.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all underline underline-offset-4"
                >
                  {brand.repoUrl.replace('https://', '')}
                </a>
              </dd>
            </div>
          </dl>
          <p lang="en" className="pt-2 font-semibold">
            {tFooter('credit', { brand: brand.name.en, author: brand.author })}
          </p>
        </section>
      </div>
    </PageShell>
  );
}
