import { Storage } from 'expo-sqlite/kv-store';
import { defaultDisplaySettings, useDisplaySettings } from './displaySettings';

describe('defaultDisplaySettings', () => {
  it('기기 언어가 한국어면 ko, 지역이 한국이면 한국식이다', () => {
    expect(defaultDisplaySettings({ languageCode: 'ko', regionCode: 'KR' })).toEqual({
      language: 'ko',
      upDownStyle: 'KR',
      disparityPeriod: '6M',
      contractPeriod: '6M',
    });
  });

  it('언어와 지역을 따로 본다', () => {
    expect(defaultDisplaySettings({ languageCode: 'en', regionCode: 'KR' })).toMatchObject({
      language: 'en',
      upDownStyle: 'KR',
    });
    expect(defaultDisplaySettings({ languageCode: 'ko', regionCode: 'US' })).toMatchObject({
      language: 'ko',
      upDownStyle: 'US',
    });
  });

  it('그 밖의 언어·지역이나 정보가 없으면 영어·미국식이다', () => {
    expect(defaultDisplaySettings({ languageCode: 'ja', regionCode: 'JP' })).toMatchObject({
      language: 'en',
      upDownStyle: 'US',
    });
    expect(defaultDisplaySettings(undefined)).toMatchObject({ language: 'en', upDownStyle: 'US' });
  });
});

describe('useDisplaySettings', () => {
  it('바꾼 값을 kv-store에 저장한다', () => {
    useDisplaySettings.getState().setLanguage('en');
    useDisplaySettings.getState().setUpDownStyle('KR');
    useDisplaySettings.getState().setDisparityPeriod('2Y');
    useDisplaySettings.getState().setContractPeriod('ALL');

    const saved = JSON.parse(Storage.getItemSync('display-settings') ?? 'null') as unknown;
    expect(saved).toEqual({
      state: { language: 'en', upDownStyle: 'KR', disparityPeriod: '2Y', contractPeriod: 'ALL' },
      version: 1,
    });
  });

  it('저장된 값으로 복원한다', async () => {
    Storage.setItemSync(
      'display-settings',
      JSON.stringify({
        state: { language: 'ko', upDownStyle: 'US', disparityPeriod: '3M', contractPeriod: '6M' },
        version: 1,
      }),
    );
    await useDisplaySettings.persist.rehydrate();

    expect(useDisplaySettings.getState()).toMatchObject({
      language: 'ko',
      upDownStyle: 'US',
      disparityPeriod: '3M',
      contractPeriod: '6M',
    });
  });
});
