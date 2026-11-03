import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors, fontSize, spacing } from '@/theme/tokens';

// iOS 숫자 키패드에는 닫는 키가 없어 키패드가 열린 동안 [완료] 줄을 보인다. Android는 키패드의 완료 키로 닫는다.
// InputAccessoryView는 RN 0.88에서 deprecated라 직접 그린다. 화면 루트를 KeyboardAvoidingView(padding)로 감싸고
// 그 맨 아래에 두면 키패드 바로 위에 붙는다
export function KeyboardDoneBar() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const subscriptions = [
      // 키패드가 다 올라온 뒤 보인다(올라오는 동안 줄이 먼저 떠서 따라 올라가 보이지 않게). 숨길 때는 바로
      Keyboard.addListener('keyboardDidShow', () => setVisible(true)),
      Keyboard.addListener('keyboardWillHide', () => setVisible(false)),
    ];
    return () => subscriptions.forEach((s) => s.remove());
  }, []);

  if (Platform.OS !== 'ios' || !visible) return null;
  return (
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" onPress={() => Keyboard.dismiss()} hitSlop={8}>
        <Text style={styles.button}>{t('common.done')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  button: {
    color: colors.text,
    fontSize: fontSize.body,
    fontWeight: '600',
  },
});
