import type { Freshness } from '@futureetp/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FooterLine, FooterText } from '@/components/FooterLine';
import { formatLocalDateTime, formatTradeDate } from '@/lib/formatDateTime';
import { useFooterFreshness } from '@/stores/footerFreshness';

// ETP 목록처럼 거래일·장 상태가 없는 화면은 기준 시각만 보낸다
export type FooterTime = Freshness | Pick<Freshness, 'asOf'>;

type Props = {
  freshness: FooterTime;
};

// A·C 화면 최하단 기준 시각 줄: `10/22 09:00 기준 · 거래일 10/22 · 지연 · 장중`(screens.md 공통 규칙).
// 새로고침이 실패해도 마지막 데이터의 기준 시각을 그대로 보여 줘 오래됨을 알린다(architecture.md).
export function FreshnessLine({ freshness }: Props) {
  const { t } = useTranslation();
  const items = [
    t('freshness.asOf', { time: formatLocalDateTime(freshness.asOf) }),
    ...('tradeDate' in freshness
      ? [
          t('freshness.tradeDate', { date: formatTradeDate(freshness.tradeDate) }),
          ...(freshness.delayed ? [t('freshness.delayed')] : []),
          t(`freshness.marketState.${freshness.marketState}`),
        ]
      : []),
  ];

  return <FooterText>{items.join(' · ')}</FooterText>;
}

// 화면 최하단 기준 시각 줄. freshness가 없어도(탭 전환 중·첫 조회 중·ETP 수집 전) 빈 줄로 자리를 지킨다
export function FreshnessFooter({ freshness }: { freshness: FooterTime | null }) {
  return <FooterLine>{freshness && <FreshnessLine freshness={freshness} />}</FooterLine>;
}

// C 탭 레이아웃의 tab-bar 아래 줄(TabFreshnessFooter)에 이 화면의 freshness를 보인다. 화면을 떠나면 비운다
export function useTabFreshness(freshness: FooterTime | undefined) {
  const setFreshness = useFooterFreshness((s) => s.setFreshness);
  useFocusEffect(
    useCallback(() => {
      setFreshness(freshness ?? null);
      return () => setFreshness(null);
    }, [freshness, setFreshness]),
  );
}

export function TabFreshnessFooter() {
  const freshness = useFooterFreshness((s) => s.freshness);
  return <FreshnessFooter freshness={freshness} />;
}
