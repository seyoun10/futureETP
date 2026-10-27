import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { useDisplaySettings } from '@/stores/displaySettings';
import { en } from './locales/en';
import { ko } from './locales/ko';

export const resources = { ko: { translation: ko }, en: { translation: en } };

const i18n = createInstance();

// 리소스가 번들에 있어 동기로 초기화한다. 언어는 표시 설정을 따르고, 설정이 바뀌면 같이 바꾼다.
export const setupI18n = () => {
  if (i18n.isInitialized) return i18n;
  void i18n.use(initReactI18next).init({
    resources,
    lng: useDisplaySettings.getState().language,
    fallbackLng: 'ko',
    initAsync: false,
    interpolation: { escapeValue: false },
  });
  useDisplaySettings.subscribe((state, prev) => {
    if (state.language !== prev.language) void i18n.changeLanguage(state.language);
  });
  return i18n;
};
