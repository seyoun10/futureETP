import { getItem, setItem } from 'expo-secure-store';
import { createUuidV4, getDeviceId, resetDeviceIdCache } from './deviceId';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  resetDeviceIdCache();
  setItem('device-id', '');
});

describe('createUuidV4', () => {
  it.each([0, 0.5, 0.999999])('난수 %s로도 v4 형식이다', (value) => {
    expect(createUuidV4(() => value)).toMatch(UUID_V4);
  });

  it('부를 때마다 다른 값이다', () => {
    expect(createUuidV4()).not.toBe(createUuidV4());
  });
});

describe('getDeviceId', () => {
  it('없으면 만들어 저장하고 다음에도 같은 값을 쓴다', () => {
    const id = getDeviceId();
    expect(id).toMatch(UUID_V4);
    expect(getItem('device-id')).toBe(id);

    resetDeviceIdCache();
    expect(getDeviceId()).toBe(id);
  });

  it('저장된 값이 형식이 아니면 새로 만든다', () => {
    setItem('device-id', 'not-a-uuid');
    const id = getDeviceId();
    expect(id).toMatch(UUID_V4);
    expect(getItem('device-id')).toBe(id);
  });
});
