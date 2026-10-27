import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppError } from '@/api/AppError';
import { colors, fontSize, spacing } from '@/theme/tokens';

type Props<T> = {
  query: UseQueryResult<T>;
  // 화면 모양에 맞춘 스켈레톤. 없으면 공용 막대 스켈레톤
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
};

// 조회 화면 상태 분기(architecture.md 화면 표시). 데이터가 한 번이라도 있으면 새로고침이 실패해도
// 그 데이터를 계속 보여 주고(기준 시각 줄로 오래됨을 알림), 처음 로딩 실패만 오류 화면이다.
export function QueryStateView<T>({ query, skeleton, children }: Props<T>) {
  if (query.data !== undefined) return children(query.data);
  if (query.isError && !query.isFetching) {
    return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;
  }
  return skeleton ?? <LoadingView />;
}

export function LoadingView() {
  const { t } = useTranslation();

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
    >
      {[0.9, 0.6, 0.75].map((width) => (
        <View key={width} style={[styles.bar, { width: `${width * 100}%` }]} />
      ))}
    </View>
  );
}

type ErrorViewProps = {
  error: unknown;
  onRetry: () => void;
};

// 안내 문구 + [다시 시도]. 문구는 에러 code로 고르고, AppError가 아니면 INTERNAL 문구다(D-042).
export function ErrorView({ error, onRetry }: ErrorViewProps) {
  const { t } = useTranslation();
  const code = error instanceof AppError ? error.code : 'INTERNAL';

  return (
    <View style={[styles.container, styles.center]}>
      <Text style={styles.message}>{t(`errors.${code}`)}</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
        <Text style={styles.retryText}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    height: spacing.xl,
    borderRadius: spacing.xs,
    backgroundColor: colors.surface,
  },
  message: {
    color: colors.text,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
  retry: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
  },
  retryText: {
    color: colors.text,
    fontSize: fontSize.body,
  },
});
