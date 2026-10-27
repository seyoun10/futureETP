import { APP_ERROR_CODES } from '@/api/AppError';
import { useDisplaySettings } from '@/stores/displaySettings';
import { resources, setupI18n } from './index';

const i18n = setupI18n();

describe('i18n', () => {
  it('표시 설정 언어로 시작하고, 설정이 바뀌면 언어를 바꾼다', () => {
    expect(i18n.language).toBe(useDisplaySettings.getState().language);

    useDisplaySettings.getState().setLanguage('ko');
    expect(i18n.t('common.retry')).toBe('다시 시도');
    useDisplaySettings.getState().setLanguage('en');
    expect(i18n.t('common.retry')).toBe('Retry');
  });

  it.each(Object.keys(resources))('%s에 모든 AppError code 문구가 있다', (lng) => {
    for (const code of APP_ERROR_CODES) {
      expect(i18n.getFixedT(lng)(`errors.${code}`)).not.toBe(`errors.${code}`);
    }
  });
});
