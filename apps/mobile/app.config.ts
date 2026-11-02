import type { ConfigContext, ExpoConfig } from 'expo/config';
import {
  AndroidConfig,
  withAndroidStyles,
  withAppBuildGradle,
  withEntitlementsPlist,
  withGradleProperties,
} from 'expo/config-plugins';
import type { ConfigPlugin } from 'expo/config-plugins';

// expo-modules-core가 process.env 값을 any로 선언해서 string으로 좁혀 읽는다.
const env: Partial<Record<string, string>> = process.env;

// 앱 변형(D-043). 기본은 production이라 변수가 없는 환경(eas update 등)에서도 prod 설정이 된다.
const variant = env.APP_VARIANT === 'development' ? 'development' : 'production';
const isDev = variant === 'development';

const BASE_ID = 'io.github.seyoon.futureetp';
const appId = isDev ? `${BASE_ID}.dev` : BASE_ID;

// prod 도메인(DuckDNS, D-036)
const PROD_API_URL = 'https://futureetp-api.duckdns.org';

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

// release 서명 키는 저장소 밖에 둔다(D-039). 경로는 gradle 속성 futureetp.signingProperties로 바꿀 수 있다.
// 파일이 없으면 release 빌드를 멈춘다. debug 키로 서명된 APK를 깔면 나중에 지우고 다시 깔아야 해서 접근 키가 사라진다.
const RELEASE_SIGNING_CONFIG = `
        release {
            def signingFile = file(findProperty('futureetp.signingProperties') ?: "\${System.getProperty('user.home')}/.config/futureetp/android-release.properties")
            if (signingFile.exists()) {
                def props = new Properties()
                signingFile.withInputStream { props.load(it) }
                storeFile file(props['storeFile'])
                storePassword props['storePassword']
                keyAlias props['keyAlias']
                keyPassword props['keyPassword']
            } else if (gradle.startParameter.taskNames.any { it.toLowerCase().contains('release') }) {
                throw new GradleException("release signing file not found: \${signingFile}")
            }
        }`;
const TEMPLATE_RELEASE_SIGNING =
  /(release \{\n(?:\s*\/\/.*\n)*\s*signingConfig signingConfigs\.)debug/;

const withReleaseSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (mod) => {
    const gradle = mod.modResults.contents;
    // 템플릿이 바뀌어 못 찾으면 debug 서명으로 남지 않게 prebuild를 실패시킨다
    if (!gradle.includes('signingConfigs {') || !TEMPLATE_RELEASE_SIGNING.test(gradle)) {
      throw new Error('withReleaseSigning: android/app/build.gradle template changed');
    }
    mod.modResults.contents = gradle
      .replace('signingConfigs {', `signingConfigs {${RELEASE_SIGNING_CONFIG}`)
      .replace(TEMPLATE_RELEASE_SIGNING, '$1release');
    return mod;
  });

// 실기기·에뮬레이터(Apple Silicon)가 모두 arm64라 네이티브 라이브러리는 arm64-v8a만 넣는다.
// 기본 4종이면 release APK가 180MB다. 개발 빌드는 expo run:android가 기기 ABI를 따로 넘긴다.
const withArm64Only: ConfigPlugin = (config) =>
  withGradleProperties(config, (mod) => {
    mod.modResults = AndroidConfig.BuildProperties.updateAndroidBuildProperty(
      mod.modResults,
      'reactNativeArchitectures',
      'arm64-v8a',
    );
    return mod;
  });

// 무료 Apple ID(Personal Team)는 Push 권한을 서명하지 못해 실기기 빌드가 실패한다(D-039).
// IOS_PERSONAL_TEAM=1일 때만 expo-notifications가 넣는 aps-environment를 뺀다. iOS 푸시 등록은 원래 하지 않는다.
const withoutPushEntitlement: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });

// 나중에 등록한 mod가 먼저 실행된다. plugins 배열(expo-notifications)보다 먼저 등록해 마지막에 돌게 한다.
const withPersonalTeam: ConfigPlugin = (config) =>
  env.IOS_PERSONAL_TEAM === '1' ? withoutPushEntitlement(config) : config;

export default ({ config }: ConfigContext): ExpoConfig =>
  withPersonalTeam(
    withArm64Only(
      withReleaseSigning(
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
          // iOS 권한 문구를 기기 언어로 보인다(InfoPlist.strings). 앱 안 언어 설정과는 따로다.
          // strings 파일에서는 $(PRODUCT_NAME)이 바뀌지 않아 앱 이름을 넣지 않는다
          locales: {
            ko: {
              ios: { NSCameraUsageDescription: '서버 접근 키 QR 코드를 읽을 때 카메라를 씁니다.' },
            },
            en: {
              ios: {
                NSCameraUsageDescription:
                  'The camera is used to scan the server access key QR code.',
              },
            },
          },
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
        }),
      ),
    ),
  );
