import { router, useSegments } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { lockLandscape, lockPortrait, useIsLandscape } from '@/lib/orientation';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useCommodityCode } from './useCommodityCode';

// C title-bar: [←] 원자재명 / 심볼 [회전] [⚙]. [←]는 탭 이력과 상관없이 A로 간다(screens.md C).
// [회전]은 C-a~C-c에서만 보이고, 바뀔 방향의 휴대폰 회전 아이콘이다(↻ 되돌리기와 구분). 가로 모드에서는 높이를 줄인다(D-076).
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
      <View style={styles.side}>
        <HeaderIconButton
          icon="arrow-left"
          label={t('common.back')}
          compact={isLandscape}
          onPress={() => router.dismissTo('/')}
        />
      </View>
      <Text
        style={[styles.title, isLandscape && styles.titleCompact]}
        numberOfLines={1}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <View style={[styles.side, styles.sideRight]}>
        {canRotate ? (
          <HeaderIconButton
            icon={isLandscape ? 'phone-rotate-portrait' : 'phone-rotate-landscape'}
            label={t('commodity.rotate')}
            compact={isLandscape}
            onPress={() => void (isLandscape ? lockPortrait() : lockLandscape())}
          />
        ) : null}
        <HeaderIconButton
          icon="cog-outline"
          label={t('settings.title')}
          compact={isLandscape}
          onPress={() => router.push('/settings')}
        />
      </View>
    </View>
  );
}

// HeaderIconButton 최소 폭(44) × 2
const SIDE_WIDTH = 88;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.barSeparator,
  },
  // 오른쪽 버튼 2개만큼 양쪽 폭을 같게 잡아 제목이 화면 가운데에 오게 한다
  side: {
    width: SIDE_WIDTH,
    flexDirection: 'row',
  },
  sideRight: {
    justifyContent: 'flex-end',
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
