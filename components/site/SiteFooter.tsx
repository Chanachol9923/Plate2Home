import { getTranslations } from 'next-intl/server';
import { brand } from '@/lib/config/brand';

export async function SiteFooter() {
  const t = await getTranslations('footer');

  return (
    <footer className="border-t-2 border-line-soft">
      <div className="mx-auto max-w-2xl space-y-1 px-4 py-6 text-sm text-ink-muted">
        <p>{t('nonCommercial')}</p>
        <p>{t('privacy')}</p>
        {/* The credit always uses the international product name. */}
        <p lang="en" className="pt-3 text-center font-semibold text-ink">
          {t('credit', { brand: brand.name.en, author: brand.author })}
        </p>
      </div>
    </footer>
  );
}
