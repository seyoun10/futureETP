import {
  getDevicePushTokenAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  setNotificationChannelAsync,
  type NotificationPermissionsStatus,
} from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDevice } from '@/api/devices';
import { registerPushDevice, setupAndroidChannels } from './registerPushDevice';

jest.mock('@/api/devices', () => ({ registerDevice: jest.fn() }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));
const mockRegister = jest.mocked(registerDevice);
const mockToken = jest.mocked(getDevicePushTokenAsync);
const mockGetPermissions = jest.mocked(getPermissionsAsync);
const mockRequest = jest.mocked(requestPermissionsAsync);
const mockChannel = jest.mocked(setNotificationChannelAsync);

const permission = (granted: boolean, canAskAgain: boolean) =>
  ({ granted, canAskAgain }) as NotificationPermissionsStatus;

const setOS = (os: typeof Platform.OS) => jest.replaceProperty(Platform, 'OS', os);

beforeEach(() => {
  jest.clearAllMocks();
  setOS('android');
  mockRegister.mockResolvedValue({ id: '00000000-0000-4000-8000-000000000000' });
  mockToken.mockResolvedValue({ type: 'android', data: 'fcm-token' });
  mockGetPermissions.mockResolvedValue(permission(true, true));
});

afterEach(() => jest.restoreAllMocks());

describe('setupAndroidChannels', () => {
  it('Android면 alerts·ops 채널을 이름과 중요도로 만든다', async () => {
    await setupAndroidChannels({ alerts: '시세 알림', ops: '운영 알림' });
    expect(mockChannel.mock.calls).toEqual([
      ['alerts', { name: '시세 알림', importance: 4 }],
      ['ops', { name: '운영 알림', importance: 3 }],
    ]);
  });

  it('iOS에서는 만들지 않는다', async () => {
    setOS('ios');
    await setupAndroidChannels({ alerts: 'a', ops: 'o' });
    expect(mockChannel).not.toHaveBeenCalled();
  });
});

describe('registerPushDevice', () => {
  it('토큰·플랫폼·앱 버전을 등록하고 토큰을 돌려준다', async () => {
    await expect(registerPushDevice()).resolves.toBe('fcm-token');
    expect(mockRegister).toHaveBeenCalledWith({
      pushToken: 'fcm-token',
      platform: 'ANDROID',
      appVersion: '1.0.0',
    });
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('iOS는 IOS로 등록한다', async () => {
    setOS('ios');
    await registerPushDevice();
    expect(mockRegister).toHaveBeenCalledWith(expect.objectContaining({ platform: 'IOS' }));
  });

  it('권한이 없고 다시 물을 수 있으면 요청한 뒤 거부돼도 등록한다', async () => {
    mockGetPermissions.mockResolvedValue(permission(false, true));
    mockRequest.mockResolvedValue(permission(false, false));
    await registerPushDevice();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('다시 물을 수 없으면 요청하지 않는다', async () => {
    mockGetPermissions.mockResolvedValue(permission(false, false));
    await registerPushDevice();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('토큰이 비어 있으면 등록하지 않는다', async () => {
    mockToken.mockResolvedValue({ type: 'android', data: '' });
    await expect(registerPushDevice()).resolves.toBeNull();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('토큰을 받지 못하면 오류를 그대로 던진다', async () => {
    mockToken.mockRejectedValue(new Error('no apns'));
    await expect(registerPushDevice()).rejects.toThrow('no apns');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('Android·iOS가 아니면 아무것도 하지 않는다', async () => {
    setOS('web');
    await expect(registerPushDevice()).resolves.toBeNull();
    expect(mockGetPermissions).not.toHaveBeenCalled();
  });
});
