import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { parseAccessKey, useHasAccessKey } from '@/api/accessToken';
import { AppError } from '@/api/AppError';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useSaveAccessKey } from './useSaveAccessKey';

// B-b 접근 키(screens.md B-b, D-044). 키가 없으면 루트 레이아웃이 스택 대신 이 화면을 띄운다([←] 없음).
// 저장하면 첫 실행은 루트가 스택으로 바꾸고, 그 밖에는 들어온 화면으로 돌아간다. QR 읽기는 다음 단계에서 붙인다.
export function AccessKeyScreen() {
  const { t } = useTranslation();
  const hasKey = useHasAccessKey();
  const [input, setInput] = useState('');
  const [badFormat, setBadFormat] = useState(false);
  const save = useSaveAccessKey();

  const submit = () => {
    const key = parseAccessKey(input);
    setBadFormat(key === null);
    save.reset();
    if (key === null) return;
    save.mutate(key, {
      onSuccess: () => {
        if (hasKey) router.back();
      },
    });
  };

  const errorMessage = badFormat ? t('accessKey.badFormat') : saveErrorMessage(save.error, t);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.accessKey')} showBack={hasKey} />
      <View style={styles.body}>
        <Text style={styles.guide}>{t('accessKey.guide')}</Text>
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
    color: colors.text,
    fontSize: fontSize.body,
  },
});
