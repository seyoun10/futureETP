import Constants from 'expo-constants';
import { Platform } from 'react-native';

// app.config.ts의 extra를 읽는 유일한 곳(D-043).
// 없는 값은 키가 빠진다. 문자열이 아닌 값({} 등)은 없는 것으로 본다.
type Extra = {
  variant: 'development' | 'production';
  apiUrl?: unknown;
  devApiToken?: unknown;
};

const stringOrNull = (value: unknown) => (typeof value === 'string' && value !== '' ? value : null);

const DEV_SERVER_PORT = 3000;

const extra = Constants.expoConfig?.extra as Extra;

export const isDevVariant = extra.variant === 'development';

export const apiUrl =
  stringOrNull(extra.apiUrl) ??
  `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:${DEV_SERVER_PORT}`;

export const devApiToken = isDevVariant ? stringOrNull(extra.devApiToken) : null;
