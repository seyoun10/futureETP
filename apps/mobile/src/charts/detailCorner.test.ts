import { leastCoveredCorner } from './detailCorner';

const area = { left: 0, top: 0, right: 400, bottom: 600 };
const box = { width: 100, height: 100 };

// x마다 세로 구간 하나씩(봉 간격 10)
const marks =
  (yAt: (x: number) => readonly [number, number] | null) => (x0: number, x1: number) => {
    const out: (readonly [number, number])[] = [];
    for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) {
      const m = yAt(x);
      if (m) out.push(m);
    }
    return out;
  };

describe('leastCoveredCorner', () => {
  it('아무것도 안 가리면 손가락 반대편 위다', () => {
    expect(leastCoveredCorner({ area, box, crosshairX: 50, marksIn: marks(() => null) })).toEqual({
      vertical: 'top',
      horizontal: 'right',
    });
    expect(leastCoveredCorner({ area, box, crosshairX: 350, marksIn: marks(() => null) })).toEqual({
      vertical: 'top',
      horizontal: 'left',
    });
  });

  it('위쪽에 표시가 몰려 있으면 아래 귀퉁이로 간다', () => {
    const marksIn = marks(() => [0, 200]);
    expect(leastCoveredCorner({ area, box, crosshairX: 50, marksIn })).toEqual({
      vertical: 'bottom',
      horizontal: 'right',
    });
  });

  it('반대편이 모두 가려지면 손가락 쪽이라도 덜 가리는 곳으로 간다', () => {
    const marksIn = marks((x) => (x >= 300 ? [0, 600] : null));
    expect(leastCoveredCorner({ area, box, crosshairX: 150, marksIn })).toEqual({
      vertical: 'top',
      horizontal: 'left',
    });
  });

  it('십자선을 덮는 귀퉁이는 고르지 않는다', () => {
    const marksIn = marks((x) => (x >= 300 ? [0, 600] : null));
    expect(leastCoveredCorner({ area, box, crosshairX: 50, marksIn })).toEqual({
      vertical: 'top',
      horizontal: 'right',
    });
  });
});
