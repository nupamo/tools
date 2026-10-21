import ko, { type Messages } from './ko';
import en from './en';
import ja from './ja';

export type { Messages };
export const LOCALES = ['ko', 'en', 'ja'] as const;
export type Locale = typeof LOCALES[number];
export type Localized = Record<Locale, string>;
export const DEFAULT_LOCALE: Locale = 'ko';
export const LOCALE_NAMES: Record<Locale, { short: string; name: string }> = {
  ko: { short: 'KO', name: '한국어' }, en: { short: 'EN', name: 'English' }, ja: { short: 'JA', name: '日本語' },
};
const MESSAGES: Record<Locale, Messages> = { ko, en, ja };
export const getMessages = (locale: Locale) => MESSAGES[locale];

// Korean lives at the site root; other languages under /en/ and /ja/. `path` is relative to a locale root, e.g. 'photo/'.
export function localePath(locale: Locale, path = '') {
  return `${import.meta.env.BASE_URL}${locale === DEFAULT_LOCALE ? '' : `${locale}/`}${path}`;
}

// getStaticPaths for pages under src/pages/[...lang]/.
export function localeStaticPaths() {
  return LOCALES.map(locale => ({ params: { lang: locale === DEFAULT_LOCALE ? undefined : locale }, props: { locale } }));
}
