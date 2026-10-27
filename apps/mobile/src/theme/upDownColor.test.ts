import { colors } from './tokens';
import { changeColor, UP_DOWN_PALETTES, upDownPalette } from './upDownColor';

describe('upDownPalette', () => {
  it('한국식은 상승 빨강·하락 파랑, 미국식은 상승 초록·하락 빨강이다', () => {
    expect(upDownPalette('KR')).toEqual({
      up: UP_DOWN_PALETTES.KR.up,
      down: UP_DOWN_PALETTES.KR.down,
      flat: colors.neutral,
    });
    expect(UP_DOWN_PALETTES.KR.up).toBe(UP_DOWN_PALETTES.US.down);
  });
});

describe('changeColor', () => {
  const palette = upDownPalette('US');

  it('부호로 상승·하락 색을 고른다', () => {
    expect(changeColor(0.5, palette)).toBe(palette.up);
    expect(changeColor(-0.01, palette)).toBe(palette.down);
  });

  it('0과 NaN은 방향 없는 색이다', () => {
    expect(changeColor(0, palette)).toBe(palette.flat);
    expect(changeColor(-0, palette)).toBe(palette.flat);
    expect(changeColor(Number.NaN, palette)).toBe(palette.flat);
  });
});
