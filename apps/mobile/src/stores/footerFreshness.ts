import type { Freshness } from '@futureetp/shared';
import { create } from 'zustand';

type FooterFreshnessState = {
  freshness: Freshness | null;
  setFreshness: (freshness: Freshness | null) => void;
};

// C 탭 화면이 tab-bar 아래 기준 시각 줄에 보여 줄 freshness. 지금 보고 있는 탭이 채우고 떠날 때 비운다.
// 기기에 저장하지 않는다
export const useFooterFreshness = create<FooterFreshnessState>()((set) => ({
  freshness: null,
  setFreshness: (freshness) => set({ freshness }),
}));
