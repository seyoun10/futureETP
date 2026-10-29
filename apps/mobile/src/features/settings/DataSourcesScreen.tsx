import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { SectionHeader } from './SectionHeader';

// 줄 순서는 screens.md 데이터 출처 그대로다. 소스가 바뀌면 문구(i18n dataSources)도 바꾼다.
const SECTIONS = [
  { title: 'futures', rows: ['exchange', 'settlement', 'intraday', 'history'] },
  { title: 'etp', rows: ['etpKr', 'etpUs'] },
] as const;

// B > 데이터 출처. 업체 약관의 출처 표기를 지키는 읽기 전용 화면이다(product.md, D-011). 상표·로고 없이 이름만 쓴다.
export function DataSourcesScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('settings.dataSources')} />
      <ScrollView>
        {SECTIONS.map(({ title, rows }) => (
          <View key={title}>
            <SectionHeader title={t(`dataSources.sections.${title}`)} />
            {rows.map((row) => (
              <View key={row} style={styles.row}>
                <Text style={styles.label}>{t(`dataSources.rows.${row}.label`)}</Text>
                <Text style={styles.value}>{t(`dataSources.rows.${row}.value`)}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={styles.notice}>{t('dataSources.notice')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  label: {
    flexShrink: 0,
    color: colors.textSecondary,
    fontSize: fontSize.body,
  },
  value: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.body,
    textAlign: 'right',
  },
  notice: {
    padding: spacing.lg,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
});
