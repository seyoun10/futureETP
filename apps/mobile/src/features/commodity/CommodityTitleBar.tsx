import { router, useSegments } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { lockLandscape, lockPortrait, useIsLandscape } from '@/lib/orientation';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useCommodityCode } from './useCommodityCode';

// C title-bar: [←] 원자재명 / 심볼 [⟲] [⚙]. [←]는 탭 이력과 상관없이 A로 간다(screens.md C).
// [⟲]는 C-a~C-c에서만 보이고, 가로 모드에서는 높이를 줄인다(D-076).
export function CommodityTitleBar() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const code = useCommodityCode();
  const title = code ? `${t(`commodities.${code}`)} / ${code}` : '';
  const segments = useSegments();
  const isLandscape = useIsLandscape();
  const canRotate = segments.at(-1) !== 'etps';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <HeaderIconButton
        glyph="←"
        label={t('common.back')}
        compact={isLandscape}
        onPress={() => router.dismissTo('/')}
      />
      <Text
        style={[styles.title, isLandscape && styles.titleCompact]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      {canRotate ? (
        <HeaderIconButton
          glyph="⟲"
          label={t('commodity.rotate')}
          compact={isLandscape}
          onPress={() => void (isLandscape ? lockPortrait() : lockLandscape())}
        />
      ) : null}
      <HeaderIconButton
        glyph="⚙︎"
        label={t('settings.title')}
        compact={isLandscape}
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
  titleCompact: {
    fontSize: fontSize.body,
  },
});
