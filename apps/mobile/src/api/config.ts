import Constants from 'expo-constants';
import { Platform } from 'react-native';

// app.config.ts의 extra를 읽는 유일한 곳(D-043).
type Extra = {
  variant: 'development' | 'production';
  apiUrl: string | null;
  devApiToken?: string | null;
};

const DEV_SERVER_PORT = 3000;

const extra = Constants.expoConfig?.extra as Extra;

export const isDevVariant = extra.variant === 'development';

export const apiUrl =
  extra.apiUrl ??
  `http://${Platform.OS === 'android' ? '10.0.2.2' : 'localhost'}:${DEV_SERVER_PORT}`;

export const devApiToken = isDevVariant ? (extra.devApiToken ?? null) : null;
