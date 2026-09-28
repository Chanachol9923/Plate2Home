import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ManagePanel } from '@/components/flows/ManagePanel';
import { PageShell } from '@/components/site/PageShell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('manage');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function ManagePage() {
  const t = await getTranslations('manage');
  return (
    <PageShell title={t('title')}>
      <ManagePanel />
    </PageShell>
  );
}
