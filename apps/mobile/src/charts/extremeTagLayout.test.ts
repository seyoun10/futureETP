import { extremeTagLeft, extremeTagTop } from './extremeTagLayout';

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

// 차트 0~500, 꼬리표 너비 100, 화살표 너비 10
const placeX = (kind: 'high' | 'low', x: number) => extremeTagLeft(kind, x, 100, 10, 0, 500);

describe('extremeTagLeft', () => {
  it('고가는 화살표를 끝에, 저가는 앞에 두고 화살표 가운데를 봉에 맞춘다', () => {
    expect(placeX('high', 250)).toEqual({ left: 155, arrowFirst: false });
    expect(placeX('low', 250)).toEqual({ left: 245, arrowFirst: true });
  });

  it('왼쪽 끝을 넘는 고가는 화살표를 앞으로 옮긴다', () => {
    expect(placeX('high', 40)).toEqual({ left: 35, arrowFirst: true });
  });

  it('오른쪽 끝을 넘는 저가는 화살표를 뒤로 옮긴다', () => {
    expect(placeX('low', 460)).toEqual({ left: 365, arrowFirst: false });
  });

  it('봉이 왼쪽 끝에 붙어 화살표 앞도 조금 넘치는 고가는 화살표를 앞에 두고 민다', () => {
    expect(placeX('high', 3)).toEqual({ left: 0, arrowFirst: true });
  });

  it('봉이 오른쪽 끝에 붙어 화살표 뒤도 조금 넘치는 저가는 화살표를 뒤에 두고 민다', () => {
    expect(placeX('low', 498)).toEqual({ left: 400, arrowFirst: false });
  });

  it('양쪽 다 넘으면 덜 넘치는 쪽으로 두고 차트 안으로 민다', () => {
    expect(extremeTagLeft('high', 50, 100, 10, 0, 120)).toEqual({ left: 20, arrowFirst: true });
    expect(extremeTagLeft('high', 80, 100, 10, 0, 120)).toEqual({ left: 0, arrowFirst: false });
  });
});
