import type { ConfigContext, ExpoConfig } from 'expo/config';

// 앱 변형(D-043). 기본은 production이라 변수가 없는 환경(eas update 등)에서도 prod 설정이 된다.
const variant = process.env.APP_VARIANT === 'development' ? 'development' : 'production';
const isDev = variant === 'development';

const BASE_ID = 'io.github.seyoon.futureetp';
const appId = isDev ? `${BASE_ID}.dev` : BASE_ID;

// prod 도메인은 첫 서버 배포 때 정한다(D-036). 그전까지는 연결되지 않는 주소로 둔다.
const PROD_API_URL = 'https://futureetp.invalid';

// dev 값은 apps/mobile/.env.local(커밋 안 함)에서 읽는다. prod config에는 넣지 않는다(D-044).
const extra = isDev
  ? {
      variant,
      apiUrl: process.env.DEV_API_URL ?? null,
      devApiToken: process.env.DEV_API_TOKEN ?? null,
    }
  : { variant, apiUrl: PROD_API_URL };

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isDev ? 'futureETP Dev' : 'futureETP',
  slug: 'futureetp',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: isDev ? 'futureetp-dev' : 'futureetp',
  userInterfaceStyle: 'dark',
  backgroundColor: '#000000',
  ios: {
    bundleIdentifier: appId,
  },
  android: {
    package: appId,
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#000000',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra,
});
