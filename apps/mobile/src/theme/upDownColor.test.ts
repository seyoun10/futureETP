import { colors } from './tokens';
import { changeColor, changePairColor, UP_DOWN_PALETTES, upDownPalette } from './upDownColor';

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

  it('자릿수를 주면 반올림해 보이는 값으로 고른다', () => {
    expect(changeColor(-0.04, palette, 1)).toBe(palette.flat);
    expect(changeColor(0.04, palette, 1)).toBe(palette.flat);
    expect(changeColor(-0.05, palette, 1)).toBe(palette.down);
    expect(changeColor(0.06, palette, 1)).toBe(palette.up);
  });
});

describe('changePairColor', () => {
  const palette = upDownPalette('KR');

  it('변화량·등락률이 둘 다 반올림해 0이면 방향 없는 색이다', () => {
    expect(changePairColor(0.0004, 0.004, 3, palette)).toBe(palette.flat);
    expect(changePairColor(-0.04, -0.001, 1, palette)).toBe(palette.flat);
  });

  it('둘 중 0이 아닌 쪽의 부호를 따른다', () => {
    expect(changePairColor(0.0004, 0.014, 3, palette)).toBe(palette.up);
    expect(changePairColor(-0.1, -0.002, 1, palette)).toBe(palette.down);
  });
});
