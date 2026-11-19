import type { Freshness } from '@futureetp/shared';
import { create } from 'zustand';

// ETP 목록처럼 거래일·장 상태가 없는 화면은 기준 시각만 보낸다
export type FooterTime = Freshness | Pick<Freshness, 'asOf'>;

type FooterFreshnessState = {
  freshness: FooterTime | null;
  setFreshness: (freshness: FooterTime | null) => void;
};

// C 탭 화면이 tab-bar 아래 기준 시각 줄에 보여 줄 freshness(ETP 탭은 수집 시각만). 지금 보고 있는 탭이 채우고 떠날 때 비운다.
// 기기에 저장하지 않는다
export const useFooterFreshness = create<FooterFreshnessState>()((set) => ({
  freshness: null,
  setFreshness: (freshness) => set({ freshness }),
}));
