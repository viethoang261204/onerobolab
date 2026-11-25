import { useSyncExternalStore } from 'react';
import { browserStorage, type KeyValueStorage } from '../persistence/storage';

/*
 * Tiny, dependency-free i18n. Vietnamese is the product language; English is
 * kept for international schools and as the reference for translators.
 *
 * Messages live next to the UI that uses them, one catalogue per area
 * (`features/<area>/<area>.messages.ts`), so areas never conflict:
 *
 *   export const homeMessages = defineMessages({
 *     en: { greeting: (p: { name: string }) => `Hi, ${p.name}!`, continue: 'Continue' },
 *     vi: { greeting: (p) => `Chào ${p.name}!`, continue: 'Học tiếp' },
 *   });
 *   const m = useMessages(homeMessages);   // in a component
 *   m.greeting({ name }) · m.continue
 *
 * `vi` must have exactly the same keys and parameter types as `en` (checked by
 * TypeScript). Outside React use `messagesFor(catalogue)`.
 */

export type Locale = 'vi' | 'en';
export const LOCALES: readonly { readonly id: Locale; readonly label: string }[] = [
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'en', label: 'English' },
];
export const DEFAULT_LOCALE: Locale = 'vi';

/** A message: plain text, or a function of typed parameters. */
// `any` here only lets each message declare its own parameter type (inferred per message).
export type Message = string | ((params: any) => string);
export type MessageTable = Readonly<Record<string, Message>>;

/** Same keys, same message kinds and parameters as the English table. */
export type Translation<T extends MessageTable> = { readonly [K in keyof T]: T[K] extends (p: infer P) => string ? (p: P) => string : string };

export interface Catalogue<T extends MessageTable> {
  readonly en: T;
  readonly vi: Translation<T>;
}

/** Declares an area's messages (English is the reference shape). */
export const defineMessages = <T extends MessageTable>(c: { en: T; vi: Translation<T> }): Catalogue<T> => c;

const KEY = 'roboverse.locale.v1';
const isLocale = (v: unknown): v is Locale => v === 'vi' || v === 'en';

let storage: KeyValueStorage | null = null;
// English until `initLocale()` runs (the app calls it at startup; tests that render UI read English).
let current: Locale = 'en';
const listeners = new Set<() => void>();

function readSaved(s: KeyValueStorage): Locale {
  try {
    const v = s.getItem(KEY);
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Loads the saved locale (call once at startup; tests may pass their own storage). */
export function initLocale(s: KeyValueStorage = browserStorage()): Locale {
  storage = s;
  current = readSaved(s);
  applyDocumentLang(current);
  return current;
}

function applyDocumentLang(l: Locale): void {
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

export const getLocale = (): Locale => current;

export function setLocale(l: Locale): void {
  if (l === current) return;
  current = l;
  try {
    storage?.setItem(KEY, l);
  } catch {
    // storage full / blocked: the choice still applies to this session
  }
  applyDocumentLang(l);
  for (const fn of listeners) fn();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** The current locale; re-renders when it changes. */
export const useLocale = (): Locale => useSyncExternalStore(subscribe, getLocale, getLocale);

/** The area's messages in the current locale (non-React code). */
export const messagesFor = <T extends MessageTable>(c: Catalogue<T>, locale: Locale = current): Translation<T> => (locale === 'en' ? (c.en as unknown as Translation<T>) : c.vi);

/** The area's messages in the current locale; re-renders on a locale change. */
export function useMessages<T extends MessageTable>(c: Catalogue<T>): Translation<T> {
  return messagesFor(c, useLocale());
}

/** Locale-aware number formatting ("1.250" in Vietnamese, "1,250" in English). */
export const formatNumber = (n: number, locale: Locale = current): string => n.toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US');
