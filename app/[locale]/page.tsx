import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import {
  ArrowRightIcon,
  PostsIcon,
  SearchIcon,
  CameraIcon,
  LostPlateIcon,
  MatchIcon,
  PhoneIcon,
} from '@/components/icons';
import { Phrased } from '@/components/ui/Phrased';
import { actionTile, bigLink } from '@/components/ui/styles';
import { Link } from '@/i18n/navigation';

function ActionTile({
  href,
  icon,
  title,
  hint,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <Link href={href} className={actionTile}>
      <span className="text-ink">{icon}</span>
      <span className="font-heading text-xl font-bold">{title}</span>
      <span className="text-sm text-ink-muted">{hint}</span>
    </Link>
  );
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      {/* Numbered like a road-sign panel. */}
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-accent font-heading font-bold text-on-accent"
      >
        {n}
      </span>
      <span className="flex flex-1 items-start justify-between gap-3 pt-0.5">
        <span>{children}</span>
        <span className="shrink-0 text-ink-muted">{icon}</span>
      </span>
    </li>
  );
}

export default async function HomePage() {
  const t = await getTranslations('home');

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 pb-12">
      <h1 className="text-2xl font-bold">
        <Phrased text={t('title')} />
      </h1>
      <p className="mt-2 text-ink-muted">{t('lead')}</p>

      <nav aria-label={t('actionsLabel')} className="mt-6 grid grid-cols-2 gap-3">
        <ActionTile
          href="/lost"
          icon={<LostPlateIcon size={40} />}
          title={t('lost.title')}
          hint={t('lost.hint')}
        />
        <ActionTile
          href="/found"
          icon={<CameraIcon size={40} />}
          title={t('found.title')}
          hint={t('found.hint')}
        />
      </nav>

      {/* Full-width, bordered and with an icon: easy to spot for people checking a plate. */}
      <Link href="/search" className={`${bigLink} mt-4`}>
        <SearchIcon size={28} />
        <span className="flex-1">{t('search')}</span>
        <ArrowRightIcon size={24} />
      </Link>

      <Link href="/my-posts" className={`${bigLink} mt-3`}>
        <PostsIcon size={28} />
        <span className="flex-1">{t('myPosts')}</span>
        <ArrowRightIcon size={24} />
      </Link>
      <p className="mt-3 text-center text-sm">
        <Link href="/manage" className="font-semibold underline underline-offset-4">
          {t('manage')}
        </Link>
      </p>

      <section aria-labelledby="how-title" className="mt-10 border-t-2 border-line-soft pt-6">
        <h2 id="how-title" className="text-lg font-bold">
          {t('how.title')}
        </h2>
        <ol className="mt-3 space-y-3">
          <Step n={1} icon={<CameraIcon />}>
            {t('how.step1')}
          </Step>
          <Step n={2} icon={<MatchIcon />}>
            {t('how.step2')}
          </Step>
          <Step n={3} icon={<PhoneIcon />}>
            {t('how.step3')}
          </Step>
        </ol>
      </section>
    </div>
  );
}
