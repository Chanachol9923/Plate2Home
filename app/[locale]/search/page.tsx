import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SearchPanel } from '@/components/flows/SearchPanel';
import { PageShell } from '@/components/site/PageShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('search');
  return { title: t('title') };
}

export default async function SearchPage() {
  const t = await getTranslations('search');
  return (
    <PageShell title={t('title')}>
      <SearchPanel />
    </PageShell>
  );
}
