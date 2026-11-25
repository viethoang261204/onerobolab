import { defineMessages } from '../../features/i18n/i18n';

/** Shared game-UI components (error boundary, difficulty meter, page loading). */
export const commonMessages = defineMessages({
  en: {
    errorBody: 'Something went wrong on our side. Your program is saved.',
    tryAgain: 'Try again',
    difficulty: (p: { n: number }) => `Difficulty ${p.n} of 5`,
    loading: 'Loading',
  },
  vi: {
    errorBody: 'Có lỗi ở phía chúng mình. Chương trình của em vẫn được lưu.',
    tryAgain: 'Thử lại',
    difficulty: (p) => `Độ khó ${p.n}/5`,
    loading: 'Đang tải',
  },
});
