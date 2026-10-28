import type { ConfigContext, ExpoConfig } from 'expo/config';

// expo-modules-core가 process.env 값을 any로 선언해서 string으로 좁혀 읽는다.
const env: Partial<Record<string, string>> = process.env;

// 앱 변형(D-043). 기본은 production이라 변수가 없는 환경(eas update 등)에서도 prod 설정이 된다.
const variant = env.APP_VARIANT === 'development' ? 'development' : 'production';
const isDev = variant === 'development';

const BASE_ID = 'io.github.seyoon.futureetp';
const appId = isDev ? `${BASE_ID}.dev` : BASE_ID;

// prod 도메인은 첫 서버 배포 때 정한다(D-036). 그전까지는 연결되지 않는 주소로 둔다.
const PROD_API_URL = 'https://futureetp.invalid';

// dev 값은 apps/mobile/.env.local(커밋 안 함)에서 읽는다. prod config에는 넣지 않는다(D-044).
// 값이 없으면 키를 뺀다. Expo가 config를 직렬화할 때 null을 {}로 바꾼다.
const extra = isDev
  ? {
      variant,
      apiUrl: env.DEV_API_URL,
      devApiToken: env.DEV_API_TOKEN,
    }
  : { variant, apiUrl: PROD_API_URL };

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: isDev ? 'futureETP Dev' : 'futureETP',
  slug: 'futureetp',
  version: '1.0.0',
  // 가로 잠금은 C-a~C-c [⟲]에서만 한다. 'portrait'면 iOS가 가로 잠금을 거부한다(D-076).
  orientation: 'default',
  icon: './assets/images/icon.png',
  scheme: isDev ? 'futureetp-dev' : 'futureetp',
  userInterfaceStyle: 'dark',
  backgroundColor: '#000000',
  ios: {
    bundleIdentifier: appId,
    // iPad에서 화면 잠금이 동작하는 조건(expo-screen-orientation)
    requireFullScreen: true,
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
    'expo-localization',
    'expo-sqlite',
    // 기본값으로 Android 자동 백업에서 SecureStore 값을 뺀다(복원된 암호문은 읽을 수 없음)
    'expo-secure-store',
    // 접근 키 QR 읽기만 쓴다(D-044). 녹화를 하지 않으므로 마이크 권한은 넣지 않는다.
    [
      'expo-camera',
      {
        cameraPermission: 'Allow $(PRODUCT_NAME) to scan the server access key QR code.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    ['expo-screen-orientation', { initialOrientation: 'PORTRAIT_UP' }],
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
