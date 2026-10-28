// expo-sqlite kv-store는 네이티브 모듈이라 Jest에서는 메모리 Map으로 바꾼다(표시 설정 persist, D-030).
jest.mock('expo-sqlite/kv-store', () => {
  const items = new Map<string, string>();
  return {
    Storage: {
      getItemSync: (key: string) => items.get(key) ?? null,
      setItemSync: (key: string, value: string) => {
        items.set(key, value);
      },
      removeItemSync: (key: string) => items.delete(key),
      clearSync: () => {
        items.clear();
        return true;
      },
    },
  };
});

// expo-secure-store도 네이티브 모듈이라 메모리 Map으로 바꾼다(접근 키, D-044).
jest.mock('expo-secure-store', () => {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    getItemAsync: (key: string) => Promise.resolve(items.get(key) ?? null),
    setItemAsync: (key: string, value: string) => {
      items.set(key, value);
      return Promise.resolve();
    },
    deleteItemAsync: (key: string) => {
      items.delete(key);
      return Promise.resolve();
    },
  };
});

// expo-camera도 네이티브 모듈이다. 카메라는 props를 그대로 받는 View로 두고(테스트가 이벤트를 보냄),
// 권한 요청은 기본으로 허용한다. 테스트는 mockRequestCameraPermission으로 결과를 바꾼다.
jest.mock('expo-camera', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const requestPermission = jest.fn(() => Promise.resolve({ granted: true }));
  return {
    CameraView: View,
    useCameraPermissions: () => [null, requestPermission, jest.fn()],
    mockRequestCameraPermission: requestPermission,
  };
});

// Jest에는 app config extra가 없다. 키가 없는 prod 변형으로 둔다(테스트가 필요하면 키를 직접 넣음).
jest.mock('@/api/config', () => ({
  isDevVariant: false,
  apiUrl: 'http://api.test',
  devApiToken: null,
}));

// jest-expo의 기기 시간대는 America/New_York이다. 테스트 설정 값(Asia/Seoul)과 맞춰 시간대 PATCH가
// 끼어들지 않게 한다. 시간대를 바꿔 보는 테스트는 jest.mocked(getCalendars)로 바꾼다(D-084).
jest.mock('expo-localization', () => {
  const actual = jest.requireActual<typeof import('expo-localization')>('expo-localization');
  return {
    ...actual,
    getCalendars: jest.fn(() => [{ ...actual.getCalendars()[0], timeZone: 'Asia/Seoul' }]),
  };
});

// Skia·Victory Native는 Jest에서 돌지 않는다. 차트는 아무것도 그리지 않는 jest.fn으로 두고,
// 화면 테스트는 jest.mocked(CandleChart).mock.lastCall로 받은 props(renderDetail 등)를 확인한다.
jest.mock('@/charts/CandleChart', () => ({ CandleChart: jest.fn(() => null) }));
jest.mock('@/charts/CurveChart', () => ({ CurveChart: jest.fn(() => null) }));
