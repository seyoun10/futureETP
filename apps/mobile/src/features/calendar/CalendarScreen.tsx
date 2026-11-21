import { CALENDAR_MARKETS } from '@futureetp/shared';
import type { Calendar, CalendarException } from '@futureetp/shared';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { QueryStateView } from '@/components/QueryStateView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatTradeDate } from '@/lib/formatDateTime';
import { colors, fontSize, radius, spacing } from '@/theme/tokens';
import { monthCells, monthsFrom, monthsRange, localDateKey, weekdayOf } from './monthGrid';
import type { CalendarMonth } from './monthGrid';
import { useMarketCalendar } from './useMarketCalendar';

const MONTH_COUNT = 3;
// i18n 키. 요일은 0 = 일요일 순, 달은 1월부터
const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const MONTH_KEYS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

const isClosed = (e: CalendarException) => e.kind === 'CLOSED' || e.kind === 'HALT';

// 휴장 달력(A title-bar [📅]). 이번 달~다다음 달을 세로로 놓고 CME·KRX·NYSE 예외 일정을 함께 표시한다.
// 오늘은 기기 로컬 날짜다. 화면을 여는 동안 날짜가 바뀌어도 다시 열 때까지 그대로 둔다.
export function CalendarScreen() {
  const { t } = useTranslation();
  const [today] = useState(() => new Date());
  const months = monthsFrom(today, MONTH_COUNT);
  const { from, to } = monthsRange(months);
  const query = useMarketCalendar(from, to);

  return (
    <View style={styles.container}>
      <ScreenHeader title={t('calendar.title')} />
      <QueryStateView query={query}>
        {(data) => <CalendarBody data={data} months={months} todayKey={localDateKey(today)} />}
      </QueryStateView>
    </View>
  );
}

function CalendarBody({
  data,
  months,
  todayKey,
}: {
  data: Calendar;
  months: CalendarMonth[];
  todayKey: string;
}) {
  const { t } = useTranslation();
  const byDate = new Map<string, CalendarException[]>();
  for (const e of data.exceptions) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Legend />
      {data.missing.map(({ market, year }) => (
        <Text key={`${market}-${year}`} style={styles.missing}>
          {t('calendar.missing', { market: t(`calendar.markets.${market}`), year })}
        </Text>
      ))}
      {months.map((month) => (
        <MonthView
          key={`${month.year}-${month.month}`}
          month={month}
          byDate={byDate}
          todayKey={todayKey}
        />
      ))}
    </ScrollView>
  );
}

function Legend() {
  const { t } = useTranslation();

  return (
    <View style={styles.legend}>
      {CALENDAR_MARKETS.map((market) => (
        <View key={market} style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: colors.market[market] }]} />
          <Text style={styles.legendText}>{t(`calendar.markets.${market}`)}</Text>
        </View>
      ))}
      <View style={styles.legendItem}>
        <View style={[styles.dot, { backgroundColor: colors.textSecondary }]} />
        <Text style={styles.legendText}>{t('calendar.legendClosed')}</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={[styles.dot, styles.hollowDot, { borderColor: colors.textSecondary }]} />
        <Text style={styles.legendText}>{t('calendar.legendShortened')}</Text>
      </View>
      <View style={styles.legendItem}>
        <View style={styles.legendToday} />
        <Text style={styles.legendText}>{t('calendar.legendToday')}</Text>
      </View>
    </View>
  );
}

function MonthView({
  month,
  byDate,
  todayKey,
}: {
  month: CalendarMonth;
  byDate: Map<string, CalendarException[]>;
  todayKey: string;
}) {
  const { t } = useTranslation();
  const cells = monthCells(month);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const monthName = t(`calendar.months.${MONTH_KEYS[month.month - 1]!}`);
  const items = cells
    .filter((date): date is string => date !== null)
    .flatMap((date) => byDate.get(date) ?? []);

  return (
    <View style={styles.month} testID={`calendar-month-${month.year}-${month.month}`}>
      <Text style={styles.monthTitle} accessibilityRole="header">
        {t('calendar.monthTitle', { year: month.year, month: monthName })}
      </Text>
      <View style={styles.week}>
        {WEEKDAY_KEYS.map((key, weekday) => (
          <Text key={key} style={[styles.weekday, isWeekend(weekday) && styles.weekendText]}>
            {t(`calendar.weekdays.${key}`)}
          </Text>
        ))}
      </View>
      {weeks.map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map((date, j) =>
            date === null ? (
              <View key={`empty-${j}`} style={styles.cell} />
            ) : (
              <DayCell
                key={date}
                date={date}
                monthName={monthName}
                exceptions={byDate.get(date) ?? []}
                isToday={date === todayKey}
              />
            ),
          )}
        </View>
      ))}
      <View style={styles.list}>
        {items.length === 0 ? (
          <Text style={styles.listEmpty}>{t('calendar.none')}</Text>
        ) : (
          items.map((e) => <ExceptionLine key={`${e.market}-${e.date}`} exception={e} />)
        )}
      </View>
    </View>
  );
}

const isWeekend = (weekday: number) => weekday === 0 || weekday === 6;

function DayCell({
  date,
  monthName,
  exceptions,
  isToday,
}: {
  date: string;
  monthName: string;
  exceptions: CalendarException[];
  isToday: boolean;
}) {
  const { t } = useTranslation();
  const day = Number(date.slice(8, 10));
  const label = [
    t('calendar.cellDate', { month: monthName, day }),
    ...(isToday ? [t('calendar.legendToday')] : []),
    ...exceptions.map((e) => `${t(`calendar.markets.${e.market}`)} ${kindText(t, e)}`),
  ].join(', ');

  return (
    <View style={styles.cell} accessible accessibilityLabel={label} testID={`calendar-day-${date}`}>
      <View style={[styles.dayNumber, isToday && styles.today]}>
        <Text style={[styles.dayText, isWeekend(weekdayOf(date)) && styles.weekendText]}>
          {day}
        </Text>
      </View>
      <View style={styles.dots}>
        {exceptions.map((e) => (
          <View
            key={e.market}
            style={[
              styles.dot,
              isClosed(e)
                ? { backgroundColor: colors.market[e.market] }
                : [styles.hollowDot, { borderColor: colors.market[e.market] }],
            ]}
          />
        ))}
      </View>
    </View>
  );
}

type T = ReturnType<typeof useTranslation>['t'];

function kindText(t: T, e: CalendarException): string {
  const tz = t(`calendar.timeZones.${e.market}`);
  return t(`calendar.kinds.${e.kind}`, { time: e.at ?? '', tz });
}

function ExceptionLine({ exception: e }: { exception: CalendarException }) {
  const { t } = useTranslation();
  const date = t('calendar.listDate', {
    date: formatTradeDate(e.date),
    weekday: t(`calendar.weekdays.${WEEKDAY_KEYS[weekdayOf(e.date)]!}`),
  });

  return (
    <View style={styles.line}>
      <Text style={styles.lineDate}>{date}</Text>
      <View style={[styles.marketTag, { borderColor: colors.market[e.market] }]}>
        <Text style={[styles.marketText, { color: colors.market[e.market] }]}>
          {t(`calendar.markets.${e.market}`)}
        </Text>
      </View>
      <Text style={styles.lineText}>
        {kindText(t, e)}
        <Text style={styles.note}>{` · ${e.note}`}</Text>
      </Text>
    </View>
  );
}

const DOT = 6;
const DAY_SIZE = 30;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    paddingVertical: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendText: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  legendToday: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.today,
  },
  missing: {
    color: colors.error,
    fontSize: fontSize.caption,
    paddingBottom: spacing.xs,
  },
  month: {
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    marginTop: spacing.sm,
  },
  monthTitle: {
    color: colors.text,
    fontSize: fontSize.title,
    fontWeight: '600',
    paddingBottom: spacing.sm,
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.text,
    fontSize: fontSize.caption,
    paddingBottom: spacing.xs,
  },
  weekendText: {
    color: colors.textSecondary,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    minHeight: 48,
  },
  dayNumber: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: {
    borderWidth: 1.5,
    borderColor: colors.today,
  },
  dayText: {
    color: colors.text,
    fontSize: fontSize.body,
    fontVariant: ['tabular-nums'],
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    height: DOT + 2,
    marginTop: 2,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  hollowDot: {
    borderWidth: 1,
  },
  list: {
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  listEmpty: {
    color: colors.textSecondary,
    fontSize: fontSize.caption,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  lineDate: {
    width: 64,
    color: colors.text,
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
  },
  marketTag: {
    width: 40,
    borderWidth: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  marketText: {
    fontSize: 10,
    fontWeight: '600',
  },
  lineText: {
    flex: 1,
    color: colors.text,
    fontSize: fontSize.caption,
  },
  note: {
    color: colors.textSecondary,
  },
});
