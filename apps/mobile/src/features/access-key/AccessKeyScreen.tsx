import { useEffect, useState } from 'react';
import { useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  clearKeyRejected,
  parseAccessKey,
  useAccessKeyStore,
  useHasAccessKey,
} from '@/api/accessToken';
import { AppError } from '@/api/AppError';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { QrScanner } from './QrScanner';
import { useSaveAccessKey } from './useSaveAccessKey';

// 서버에 묻기 전에 앱이 거른 경우의 안내
type Notice = 'badFormat' | 'notKeyQr' | 'cameraUnavailable';

// B-b 접근 키(screens.md B-b, D-044). 키가 없으면 루트 레이아웃이 스택 대신 이 화면을 띄운다([←] 없음).
// 저장하면 첫 실행은 루트가 스택으로 바꾸고, 그 밖에는 들어온 화면으로 돌아간다.
// QR이 기본이고, 카메라를 못 쓰면(권한 거부·시뮬레이터) 붙여넣기만 쓰라고 안내한다.
export function AccessKeyScreen() {
  const { t } = useTranslation();
  const hasKey = useHasAccessKey();
  const rejected = useAccessKeyStore((state) => state.rejected);
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [scanning, setScanning] = useState(false);
  const [, requestCameraPermission] = useCameraPermissions();
  const save = useSaveAccessKey();

  // 거절돼서 왔다가 새 키 없이 떠나면 표시를 지운다. 옛 키가 다시 거절되면 또 이 화면으로 온다.
  useEffect(() => clearKeyRejected, []);

  const verifyAndSave = (key: string) => {
    save.mutate(key, {
      onSuccess: () => {
        if (hasKey) router.back();
      },
    });
  };

  const submit = () => {
    const key = parseAccessKey(input);
    setNotice(key === null ? 'badFormat' : null);
    save.reset();
    if (key !== null) verifyAndSave(key);
  };

  const startScan = async () => {
    setNotice(null);
    save.reset();
    const granted = await requestCameraPermission().then(
      (permission) => permission.granted,
      () => false,
    );
    if (granted) setScanning(true);
    else setNotice('cameraUnavailable');
  };

  const onScanned = (data: string) => {
    const key = parseAccessKey(data, { requirePrefix: true });
    if (key === null) {
      setNotice('notKeyQr');
      return false;
    }
    setNotice(null);
    setScanning(false);
    verifyAndSave(key);
    return true;
  };

  const onCameraUnavailable = () => {
    setScanning(false);
    setNotice('cameraUnavailable');
  };

  // 거절돼서 왔으면 새 키를 확인하기 전까지 "키가 맞지 않습니다"를 보여 준다.
  const errorMessage = notice
    ? t(`accessKey.${notice}`)
    : (saveErrorMessage(save.error, t) ??
      (rejected && !save.isPending ? t('accessKey.rejected') : null));

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.accessKey')} showBack={hasKey} />
      <View style={styles.body}>
        <Text style={styles.guide}>{t('accessKey.guide')}</Text>
        {scanning ? (
          <QrScanner
            onScanned={onScanned}
            onUnavailable={onCameraUnavailable}
            onCancel={() => setScanning(false)}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: save.isPending }}
            disabled={save.isPending}
            onPress={() => void startScan()}
            style={styles.button}
          >
            <Text style={styles.buttonText}>{t('accessKey.scanQr')}</Text>
          </Pressable>
        )}
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={t('accessKey.pastePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel={t('accessKey.pastePlaceholder')}
          // 키 값은 화면에 보여 주지 않는다(screens.md B-b)
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          editable={!save.isPending}
          onSubmitEditing={submit}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: save.isPending || input.trim() === '' }}
          disabled={save.isPending || input.trim() === ''}
          onPress={submit}
          style={styles.button}
        >
          {save.isPending ? (
            <ActivityIndicator color={colors.text} accessibilityLabel={t('accessKey.verifying')} />
          ) : (
            <Text style={styles.buttonText}>{t('accessKey.submit')}</Text>
          )}
        </Pressable>
        {errorMessage && (
          <Text accessibilityRole="alert" style={styles.error}>
            {errorMessage}
          </Text>
        )}
      </View>
    </View>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

// 서버가 키를 거절하면 B-b 전용 문구, 그 밖(네트워크 등)은 공용 에러 문구다. 어느 경우든 저장하지 않는다.
function saveErrorMessage(error: unknown, t: T) {
  if (error === null) return null;
  const code = error instanceof AppError ? error.code : 'INTERNAL';
  return code === 'UNAUTHORIZED' ? t('accessKey.rejected') : t(`errors.${code}`);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  body: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  guide: {
    color: colors.text,
    fontSize: fontSize.body,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: fontSize.body,
  },
  button: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: spacing.sm,
    backgroundColor: colors.surfaceSelected,
  },
  buttonText: {
    color: colors.text,
    fontSize: fontSize.body,
  },
  error: {
    color: colors.error,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
});
