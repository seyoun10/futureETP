import { extremeTagTop } from './extremeTagLayout';

// 차트 0~500, 글자 높이 14, 간격 3
const place = (kind: 'high' | 'low', y: number, lineY: number | null) =>
  extremeTagTop(kind, y, 14, 3, lineY, 0, 500);

describe('extremeTagTop', () => {
  it('고가는 봉 위, 저가는 봉 아래에 둔다', () => {
    expect(place('high', 200, null)).toBe(183);
    expect(place('low', 200, null)).toBe(203);
  });

  it('현재가 점선이 멀면 그대로 둔다', () => {
    expect(place('high', 200, 300)).toBe(183);
    expect(place('low', 200, 100)).toBe(203);
  });

  it('점선이 글자를 지나가면 점선 바깥으로 옮긴다', () => {
    expect(place('high', 200, 190)).toBe(173);
    expect(place('low', 200, 210)).toBe(213);
  });

  it('점선 바깥이 차트를 넘으면 점선 봉 쪽으로 옮긴다', () => {
    // 고가 꼬리표가 위 끝에 붙어 있고 점선이 그 글자를 지나간다
    expect(place('high', 10, 8)).toBe(11);
    expect(place('low', 495, 490)).toBe(473);
  });
});
