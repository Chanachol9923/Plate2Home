import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { brand } from '@/lib/config/brand';

export async function SiteFooter() {
  const t = await getTranslations('footer');

  return (
    <footer className="border-t-2 border-line-soft">
      <div className="mx-auto max-w-2xl space-y-1 px-4 py-6 text-center text-sm text-ink-muted">
        <p>{t('nonCommercial')}</p>
        <p>{t('privacy')}</p>
        <p className="pt-2">
          <Link href="/about" className="font-semibold text-ink underline underline-offset-4">
            {t('about')}
          </Link>
        </p>
        {/* The credit always uses the international product name. */}
        <p lang="en" className="pt-3 font-semibold text-ink">
          {t('credit', { brand: brand.name.en, author: brand.author })}
        </p>
      </div>
    </footer>
  );
}
