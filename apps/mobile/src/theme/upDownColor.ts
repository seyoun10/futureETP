import { useDisplaySettings, type UpDownStyle } from '@/stores/displaySettings';
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

export const useUpDownPalette = () => upDownPalette(useDisplaySettings((s) => s.upDownStyle));
