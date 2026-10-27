import { COMMODITY_CODES } from '@futureetp/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, spacing } from '@/theme/tokens';

// A 원자재 목록. 시세 행은 5-6 수직 슬라이스에서 채우고, 지금은 C로 들어가는 이름 행만 둔다.
export function CommodityListScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader
        title="futureETP"
        showBack={false}
        right={
          <HeaderIconButton
            glyph="⚙︎"
            label={t('settings.title')}
            onPress={() => router.push('/settings')}
          />
        }
      />
      {COMMODITY_CODES.map((code) => (
        <Pressable
          key={code}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/commodity/[code]', params: { code } })}
          style={styles.row}
        >
          <Text style={styles.name}>{`${t(`commodities.${code}`)} / ${code}`}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  row: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.body,
  },
});
