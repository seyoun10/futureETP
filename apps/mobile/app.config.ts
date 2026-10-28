import type { ConfigContext, ExpoConfig } from 'expo/config';
import { AndroidConfig, withAndroidStyles } from 'expo/config-plugins';
import type { ConfigPlugin } from 'expo/config-plugins';

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

// 기준일 spinner 다이얼로그(D-091)는 라이브러리 스타일이 DayNight라 기기가 라이트 모드면 밝게 뜬다.
// 앱 리소스에 같은 이름의 스타일을 다크로 다시 정의해 덮어쓴다(앱 리소스가 라이브러리보다 우선).
// 배경은 colors.surface와 같은 값이다. config 로더가 src의 TS를 import하지 못해 값을 옮겨 적는다.
const withDarkDatePickerDialog: ConfigPlugin = (config) =>
  withAndroidStyles(config, (mod) => {
    const parent = { name: 'SpinnerDatePickerDialog', parent: 'Theme.AppCompat.Dialog' };
    const items = {
      'android:datePickerStyle': '@style/SpinnerDatePickerStyle',
      'android:windowBackground': '#1e1e1e',
    };
    for (const [name, value] of Object.entries(items)) {
      mod.modResults = AndroidConfig.Styles.assignStylesValue(mod.modResults, {
        add: true,
        parent,
        name,
        value,
      });
    }
    return mod;
  });

export default ({ config }: ConfigContext): ExpoConfig =>
  withDarkDatePickerDialog({
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
      // Firebase 설정(D-037). dev·prod 두 package가 한 파일에 들어 있다. API 키가 있어 커밋하지 않는다(.gitignore).
      googleServicesFile: './google-services.json',
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
      // 서버가 채널을 지정해 보내므로(shared ANDROID_CHANNELS) 기본 채널은 두지 않는다. 채널은 앱이 실행 때 만든다.
      'expo-notifications',
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
