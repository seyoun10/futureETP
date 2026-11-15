import type { CommodityCode } from '@futureetp/shared';
import { useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ChartSkeleton } from '@/charts/ChartSkeleton';
import { QueryStateView } from '@/components/QueryStateView';
import type { StateQuery } from '@/components/QueryStateView';
import { perfStart } from '@/lib/perfLog';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useCommodityCode } from './useCommodityCode';

// C 원자재 화면 차트 탭(C-a·C-b·C-c)의 공통 껍데기. 경로의 원자재 코드가 없으면 NOT_FOUND 문구다
export function ChartTabScreen({
  testID,
  children,
}: {
  testID: string;
  children: (code: CommodityCode) => ReactNode;
}) {
  const { t } = useTranslation();
  const code = useCommodityCode();

  return (
    <View style={styles.container} testID={testID}>
      {code ? children(code) : <ChartTabMessage>{t('errors.NOT_FOUND')}</ChartTabMessage>}
    </View>
  );
}

// 탭 가운데 안내 문구(없는 원자재, 값 없음)
export function ChartTabMessage({ children }: { children: string }) {
  return <Text style={styles.message}>{children}</Text>;
}

// 조회 상태(로딩은 차트 모양 스켈레톤, 오류는 재시도)에 따라 차트를 그린다
export function ChartTabQuery<T>({
  query,
  footer,
  children,
}: {
  query: StateQuery<T>;
  // 스켈레톤 하단: 기간 칩(C-a·C-c) 또는 기준일 단계(C-b)
  footer: ComponentProps<typeof ChartSkeleton>['footer'];
  children: (data: T) => ReactNode;
}) {
  return (
    <QueryStateView query={query} skeleton={<ChartSkeleton footer={footer} />}>
      {children}
    </QueryStateView>
  );
}

// 진입 측정은 첫 렌더에 시작한다(effect는 자식 조회 뒤라 늦다). 조회 hook보다 먼저 부른다
export function useChartTabPerf(label: string) {
  useState(() => perfStart(label));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  message: {
    color: colors.text,
    fontSize: fontSize.body,
    textAlign: 'center',
    padding: spacing.lg,
  },
});
