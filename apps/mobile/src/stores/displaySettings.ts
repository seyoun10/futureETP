import { getLocales } from 'expo-localization';
import { Storage } from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const LANGUAGES = ['ko', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

// 등락 색(D-031): 한국식 상승 빨강·하락 파랑, 미국식 상승 초록·하락 빨강.
export const UP_DOWN_STYLES = ['KR', 'US'] as const;
export type UpDownStyle = (typeof UP_DOWN_STYLES)[number];

type DisplaySettingsValues = {
  language: Language;
  upDownStyle: UpDownStyle;
};

type DisplaySettingsState = DisplaySettingsValues & {
  setLanguage: (language: Language) => void;
  setUpDownStyle: (upDownStyle: UpDownStyle) => void;
};

type DeviceLocale = { languageCode: string | null; regionCode: string | null };

// 언어는 기기 언어, 등락 색은 기기 지역을 따른다(D-033). 한국어가 아니면 영어, 한국이 아니면 미국식.
export const defaultDisplaySettings = (
  locale: DeviceLocale | undefined,
): DisplaySettingsValues => ({
  language: locale?.languageCode === 'ko' ? 'ko' : 'en',
  upDownStyle: locale?.regionCode === 'KR' ? 'KR' : 'US',
});

// 동기 API로 읽어 앱 시작 때 언어·색이 바뀌며 깜빡이지 않게 한다(D-030).
const syncStorage = {
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
  removeItem: (key: string) => {
    Storage.removeItemSync(key);
  },
};

// 기기별 UI 설정만 둔다. 서버 데이터는 TanStack Query 캐시에만 있다(D-047).
export const useDisplaySettings = create<DisplaySettingsState>()(
  persist(
    (set) => ({
      ...defaultDisplaySettings(getLocales()[0]),
      setLanguage: (language) => set({ language }),
      setUpDownStyle: (upDownStyle) => set({ upDownStyle }),
    }),
    {
      name: 'display-settings',
      version: 3,
      storage: createJSONStorage(() => syncStorage),
      // v1·v2에 저장된 C-a·C-c 기간은 버린다(원자재 화면 상태로 옮김, D-107)
      migrate: (persisted) => {
        const { language, upDownStyle } = persisted as Partial<DisplaySettingsValues>;
        return { ...(language && { language }), ...(upDownStyle && { upDownStyle }) };
      },
      partialize: ({ language, upDownStyle }) => ({ language, upDownStyle }),
    },
  ),
);
