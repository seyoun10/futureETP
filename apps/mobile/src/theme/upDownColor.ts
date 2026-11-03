import { useDisplaySettings, type UpDownStyle } from '@/stores/displaySettings';
import { CHANGE_PCT_DECIMALS } from '@/lib/formatNumber';
import { colors } from './tokens';

// 등락 색은 토큰이 아니라 표시 설정에서 고른다(D-031). 차트·목록이 같은 함수로 읽는다.
export const UP_DOWN_PALETTES = {
  KR: { up: '#ef5350', down: '#42a5f5' },
  US: { up: '#26a69a', down: '#ef5350' },
} as const satisfies Record<UpDownStyle, { up: string; down: string }>;

export type UpDownPalette = { up: string; down: string; flat: string };

export const upDownPalette = (style: UpDownStyle): UpDownPalette => ({
  ...UP_DOWN_PALETTES[style],
  flat: colors.neutral,
});

// 변화량 부호로 색을 고른다. 0·NaN은 방향 없는 색이다.
// decimals를 주면 그 자릿수로 반올림한 값(화면에 쓴 값)으로 고른다: `0.0%`로 보이는 -0.04는 방향 없는 색
export const changeColor = (change: number, palette: UpDownPalette, decimals?: number) => {
  const shown = decimals === undefined ? change : Number(change.toFixed(decimals));
  if (shown > 0) return palette.up;
  if (shown < 0) return palette.down;
  return palette.flat;
};

// 변화량과 등락률(소수 둘째 자리)을 함께 보이는 줄의 색. 둘 다 반올림해 0이면 방향 없는 색이다
// (NG처럼 변화량은 `0.000`인데 등락률은 `+0.01%`일 수 있어 둘 중 0이 아닌 쪽을 따른다)
export const changePairColor = (
  change: number,
  changePct: number,
  decimals: number,
  palette: UpDownPalette,
) => {
  const shown = Number(change.toFixed(decimals)) || Number(changePct.toFixed(CHANGE_PCT_DECIMALS));
  return changeColor(shown, palette);
};

export const useUpDownPalette = () => upDownPalette(useDisplaySettings((s) => s.upDownStyle));
