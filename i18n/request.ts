import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import * as rootParams from 'next/root-params';
import { routing } from './routing';

export default getRequestConfig(async ({ locale: explicitLocale }) => {
  // Route handlers and server actions can't read root params; they pass the locale explicitly.
  let locale = explicitLocale;
  if (!locale) {
    const param = await rootParams.locale();
    if (!hasLocale(routing.locales, param)) notFound();
    locale = param;
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: 'Asia/Bangkok',
  };
});
