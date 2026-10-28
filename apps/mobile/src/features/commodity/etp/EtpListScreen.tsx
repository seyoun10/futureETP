import { ETP_TYPES, FX_HEDGES, ETP_MARKETS } from '@futureetp/shared';
import type { CommodityCode, EtpSummary } from '@futureetp/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { QueryStateView } from '@/components/QueryStateView';
import { SegmentedControl } from '@/components/SegmentedControl';
import { formatLocalDateTime } from '@/lib/formatDateTime';
import { compactAmount } from '@/lib/formatAmount';
import { colors, fontSize, spacing } from '@/theme/tokens';
import { useCommodityCode } from '../useCommodityCode';
import {
  ETP_SORTS,
  filterEtps,
  leverageOptions,
  NO_FILTERS,
  sortEtps,
  sortValue,
  type EtpFilters,
  type EtpSort,
} from './etpListModel';
import { useEtps } from './useEtps';

// 배수 선택지가 이보다 많으면 이름을 위에 두고 전체 폭을 쓴다
const INLINE_LEVERAGE_OPTIONS = 4;

// C-d ETP 목록 탭(screens.md C-d). 필터·정렬은 받은 목록 안에서 하고 기억하지 않는다(D-017).
export function EtpListScreen() {
  const code = useCommodityCode();

  return (
    <View style={styles.container} testID="etp-list-screen">
      {code && <EtpList code={code} />}
    </View>
  );
}

function EtpList({ code }: { code: CommodityCode }) {
  const { t } = useTranslation();
  const query = useEtps(code);
  const [filters, setFilters] = useState<EtpFilters>(NO_FILTERS);
  const [sort, setSort] = useState<EtpSort>('DEFAULT');
  const etps = query.data?.etps;
  const rows = useMemo(
    () => sortEtps(filterEtps(etps ?? [], filters), sort),
    [etps, filters, sort],
  );

  return (
    <QueryStateView query={query}>
      {(data) =>
        data.etps.length === 0 ? (
          <Text style={styles.message}>{t('etp.empty')}</Text>
        ) : (
          <FlatList
            testID="etp-list"
            data={rows}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <>
                {data.asOf && (
                  <Text style={styles.asOf}>
                    {t('freshness.asOf', { time: formatLocalDateTime(data.asOf) })}
                  </Text>
                )}
                <Filters
                  etps={data.etps}
                  filters={filters}
                  onFiltersChange={setFilters}
                  sort={sort}
                  onSortChange={setSort}
                />
              </>
            }
            ListEmptyComponent={<Text style={styles.message}>{t('etp.noMatch')}</Text>}
            renderItem={({ item }) => <EtpRow etp={item} code={code} sort={sort} />}
          />
        )
      }
    </QueryStateView>
  );
}

type FiltersProps = {
  etps: readonly EtpSummary[];
  filters: EtpFilters;
  onFiltersChange: (filters: EtpFilters) => void;
  sort: EtpSort;
  onSortChange: (sort: EtpSort) => void;
};

function Filters({ etps, filters, onFiltersChange, sort, onSortChange }: FiltersProps) {
  const { t } = useTranslation();
  const all = { value: 'ALL', label: t('etp.all') } as const;
  const leverages = leverageOptions(etps);
  const set = (patch: Partial<EtpFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <View style={styles.filters}>
      <SegmentedControl
        label={t('etp.market')}
        options={[all, ...ETP_MARKETS.map((m) => ({ value: m, label: m }))]}
        value={filters.market}
        onChange={(market) => set({ market })}
      />
      <SegmentedControl
        label={t('etp.type')}
        options={[all, ...ETP_TYPES.map((type) => ({ value: type, label: type }))]}
        value={filters.type}
        onChange={(type) => set({ type })}
      />
      <SegmentedControl
        label={t('etp.leverage')}
        options={[
          all,
          ...leverages.map((n) => ({ value: n, label: t('etp.leverageValue', { n }) })),
        ]}
        value={filters.leverage}
        onChange={(leverage) => set({ leverage })}
        stacked={leverages.length > INLINE_LEVERAGE_OPTIONS}
      />
      <SegmentedControl
        label={t('etp.fxHedge')}
        options={[all, ...FX_HEDGES.map((h) => ({ value: h, label: t(`etp.fxHedges.${h}`) }))]}
        value={filters.fxHedge}
        onChange={(fxHedge) => set({ fxHedge })}
        stacked
      />
      <SegmentedControl
        label={t('etp.sort')}
        options={ETP_SORTS.map((s) => ({ value: s, label: t(`etp.sorts.${s}`) }))}
        value={sort}
        onChange={onSortChange}
      />
    </View>
  );
}

function EtpRow({ etp, code, sort }: { etp: EtpSummary; code: CommodityCode; sort: EtpSort }) {
  const { t } = useTranslation();
  // 미국 상장은 티커 + 이름(screens.md C-d)
  const title = etp.market === 'US' && etp.tickers[0] ? `${etp.tickers[0]}  ${etp.name}` : etp.name;
  const value = sortValue(etp, sort);
  const krwScheme = t('etp.krwScheme') === 'si' ? 'si' : 'eok';
  const attrs = [
    etp.market,
    etp.type,
    t('etp.leverageValue', { n: etp.leverage }),
    t(`etp.fxHedges.${etp.fxHedge}`),
    ...(value === undefined
      ? []
      : [
          t('etp.sortValue', {
            label: t(`etp.sorts.${sort}`),
            amount:
              value === null
                ? t('etp.noValue')
                : t(`etp.amount.${etp.market}`, {
                    // 달러는 언어와 상관없이 si
                    n: compactAmount(value, etp.market === 'US' ? 'si' : krwScheme),
                  }),
          }),
        ]),
  ];

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({ pathname: '/commodity/[code]/etp/[id]', params: { code, id: etp.id } })
      }
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.attrs} numberOfLines={1}>
          {attrs.join(' · ')}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  asOf: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  filters: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  message: {
    padding: spacing.xl,
    color: colors.textSecondary,
    fontSize: fontSize.body,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: fontSize.body,
  },
  attrs: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  chevron: {
    color: colors.textSecondary,
    fontSize: fontSize.title,
  },
});
