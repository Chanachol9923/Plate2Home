import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('footer');

  return (
    <footer className="border-t-2 border-line-soft">
      <div className="mx-auto max-w-2xl space-y-1 px-4 py-6 text-sm text-ink-muted">
        <p>{t('nonCommercial')}</p>
        <p>{t('privacy')}</p>
      </div>
    </footer>
  );
}
