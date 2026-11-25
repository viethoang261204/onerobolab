import { defineMessages } from '../i18n/i18n';

/** Student-facing API error texts (used when the server gave none). */
export const apiMessages = defineMessages({
  en: {
    unreachable: 'Cannot reach the server. Check your connection and try again.',
    answered: (p: { status: number }) => `The server answered ${p.status}.`,
    wentWrong: 'Something went wrong.',
  },
  vi: {
    unreachable: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
    answered: (p) => `Máy chủ trả lời lỗi ${p.status}.`,
    wentWrong: 'Có lỗi xảy ra.',
  },
});
