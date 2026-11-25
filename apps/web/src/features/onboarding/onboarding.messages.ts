import { defineMessages } from '../i18n/i18n';

/** Chrome of the spotlight tour (the step titles and bodies are content). */
export const onboardingMessages = defineMessages({
  en: {
    tour: 'Quick tour',
    step: (p: { n: number; total: number }) => `Step ${p.n} of ${p.total}`,
    skip: 'Skip tour',
    next: 'Next',
    done: 'Let’s go',
  },
  vi: {
    tour: 'Tham quan nhanh',
    step: (p) => `Bước ${p.n}/${p.total}`,
    skip: 'Bỏ qua',
    next: 'Tiếp',
    done: 'Bắt đầu thôi',
  },
});
