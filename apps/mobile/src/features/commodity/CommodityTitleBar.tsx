import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useCommodityCode } from './useCommodityCode';

// C title-bar: [←] 원자재명 / 심볼 [⚙]. [←]는 탭 이력과 상관없이 A로 간다(screens.md C).
export function CommodityTitleBar() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const code = useCommodityCode();
  const title = code ? `${t(`commodities.${code}`)} / ${code}` : '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <HeaderIconButton glyph="←" label={t('common.back')} onPress={() => router.dismissTo('/')} />
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <HeaderIconButton
        glyph="⚙︎"
        label={t('settings.title')}
        onPress={() => router.push('/settings')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '600',
    textAlign: 'center',
  },
});
