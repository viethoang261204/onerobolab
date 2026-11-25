import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../persistence/storage';
import { defineMessages, formatNumber, getLocale, initLocale, messagesFor, setLocale } from './i18n';

const demo = defineMessages({
  en: { hello: 'Hello', stars: (p: { n: number }) => `${p.n} stars` },
  vi: { hello: 'Xin chào', stars: (p) => `${p.n} sao` },
});

describe('i18n', () => {
  it('defaults to Vietnamese and remembers the choice', () => {
    const s = memoryStorage();
    expect(initLocale(s)).toBe('vi');
    expect(messagesFor(demo).hello).toBe('Xin chào');
    expect(messagesFor(demo).stars({ n: 3 })).toBe('3 sao');
    setLocale('en');
    expect(messagesFor(demo).hello).toBe('Hello');
    expect(initLocale(s)).toBe('en');
    expect(getLocale()).toBe('en');
  });

  it('ignores a corrupt saved value', () => {
    const s = memoryStorage();
    s.setItem('roboverse.locale.v1', 'xx');
    expect(initLocale(s)).toBe('vi');
  });

  it('formats numbers per locale', () => {
    expect(formatNumber(1250, 'vi')).toBe('1.250');
    expect(formatNumber(1250, 'en')).toBe('1,250');
  });
});
