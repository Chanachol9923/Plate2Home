import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai, IBM_Plex_Sans_Thai_Looped } from 'next/font/google';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SiteHeader } from '@/components/site/SiteHeader';
import { themeInitScript } from '@/components/theme/theme';
import { brand } from '@/lib/config/brand';
import '../globals.css';

// Looped letterforms for running text: easier for older Thai readers at small sizes.
const bodyFace = IBM_Plex_Sans_Thai_Looped({
  subsets: ['thai', 'latin'],
  weight: ['400', '600'],
  variable: '--font-body-face',
  display: 'swap',
});

// Loopless for headings and labels: the calm, signage-like civic voice.
const headingFace = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['700'],
  variable: '--font-heading-face',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations('meta');
  return {
    title: t('title', { brand: brand.name[locale] }),
    description: t('description'),
    applicationName: brand.name[locale],
    alternates: { languages: { th: '/', en: '/en' } },
    formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f4ee',
};

export default async function LocaleLayout({ children }: LayoutProps<'/[locale]'>) {
  const locale = await getLocale();
  const t = await getTranslations('a11y');
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang={locale}
      className={`${bodyFace.variable} ${headingFace.variable}`}
      data-theme="light"
      // The init script may switch data-theme to the stored choice before hydration.
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
        <NextIntlClientProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-on-accent"
          >
            {t('skipToContent')}
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
