import 'i18next';
import type { ko } from './locales/ko';

// 번역 키 오타를 타입 검사로 막는다(D-033).
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof ko };
  }
}
