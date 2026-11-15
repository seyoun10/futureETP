import { getItemAsync } from 'expo-secure-store';
import { AppError } from './AppError';
import {
  ACCESS_KEY_QR_PREFIX,
  getAccessToken,
  parseAccessKey,
  reportAuthError,
  saveAccessToken,
  useAccessKeyStore,
} from './accessToken';

const KEY = 'A'.repeat(21) + '-_' + 'z9'.repeat(10);

describe('parseAccessKey', () => {
  it.each([
    ['키만', KEY, KEY],
    ['접두사 + 키', `${ACCESS_KEY_QR_PREFIX}${KEY}`, KEY],
    ['앞뒤 공백', `  ${KEY}\n`, KEY],
    ['길이가 다름', KEY.slice(1), null],
    ['base64url 밖의 문자', `${KEY.slice(1)}+`, null],
    ['다른 버전 접두사', `futureetp-key:v2:${KEY}`, null],
  ])('%s', (_, input, expected) => {
    expect(parseAccessKey(input)).toBe(expected);
  });

  it('QR은 접두사가 없으면 거절한다', () => {
    expect(parseAccessKey(KEY, { requirePrefix: true })).toBeNull();
    expect(parseAccessKey(`${ACCESS_KEY_QR_PREFIX}${KEY}`, { requirePrefix: true })).toBe(KEY);
  });
});

describe('saveAccessToken', () => {
  it('SecureStore에 저장하고 요청에 쓸 키도 바꾼다', async () => {
    useAccessKeyStore.setState({ key: null });
    await saveAccessToken(KEY);

    await expect(getItemAsync('access-key')).resolves.toBe(KEY);
    await expect(getAccessToken()).resolves.toBe(KEY);
  });
});

describe('reportAuthError', () => {
  it('저장된 키로 받은 UNAUTHORIZED만 거절로 본다', () => {
    useAccessKeyStore.setState({ key: KEY, rejected: false });
    reportAuthError(new AppError('UNAUTHORIZED'));
    expect(useAccessKeyStore.getState().rejected).toBe(true);
  });

  it('키가 없어 보내지 않은 요청은 거절로 보지 않는다', () => {
    useAccessKeyStore.setState({ key: null, rejected: false });
    reportAuthError(new AppError('UNAUTHORIZED', { message: 'No access token' }));
    expect(useAccessKeyStore.getState().rejected).toBe(false);
  });
});
