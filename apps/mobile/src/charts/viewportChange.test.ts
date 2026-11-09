import type { CandleGeom, Transform } from './fitTransform';
import { nextAway, prependedBars, sameTransform, sameX } from './viewportChange';

const geom = (over: Partial<CandleGeom> = {}): CandleGeom => ({
  left: 0,
  right: 300,
  top: 0,
  bottom: 200,
  x0: 10,
  dx: 5,
  highY: [1, 2, 3],
  lowY: [4, 5, 6],
  ...over,
});

const HOME: Transform = { k: 2, tx: -300, ky: 1, ty: 0 };

describe('sameX', () => {
  it('세로 좌표만 바뀌면 같다(정보 줄 높이만 바뀜·같은 좌표 재보고)', () => {
    expect(sameX(geom(), geom({ top: 20, bottom: 180, highY: [7, 8, 9] }))).toBe(true);
  });

  it.each([
    ['폭', { right: 600 }],
    ['왼쪽 끝', { left: 5 }],
    ['첫 봉 위치', { x0: 11 }],
    ['간격', { dx: 6 }],
    ['봉 수', { highY: [1, 2, 3, 4] }],
  ])('%s이 다르면 다르다', (_label, over) => {
    expect(sameX(geom(), geom(over))).toBe(false);
  });
});

describe('sameTransform', () => {
  it('오차 안의 차이는 같다', () => {
    expect(sameTransform(HOME, { k: 2.0005, tx: -300.0005, ky: 1.0005, ty: 0.0005 })).toBe(true);
  });

  it.each(['k', 'tx', 'ky', 'ty'] as const)('%s가 오차보다 크게 다르면 다르다', (key) => {
    expect(sameTransform(HOME, { ...HOME, [key]: HOME[key] + 0.01 })).toBe(false);
  });
});

describe('prependedBars', () => {
  const prev = { barCount: 100, span: { first: '2026-01-02', last: '2026-10-27' } };

  it('과거 봉이 앞에 붙으면 늘어난 봉 수다', () => {
    expect(prependedBars(prev, 150, { first: '2025-10-01', last: '2026-10-27' })).toBe(50);
  });

  it('새로고침으로 오늘 봉이 뒤에 붙으면 0이다', () => {
    expect(prependedBars(prev, 101, { first: '2026-01-02', last: '2026-10-28' })).toBe(0);
  });

  it('앞뒤가 함께 늘어도 0이다', () => {
    expect(prependedBars(prev, 151, { first: '2025-10-01', last: '2026-10-28' })).toBe(0);
  });

  it('날짜가 그대로면 0이다', () => {
    expect(prependedBars(prev, 100, prev.span)).toBe(0);
  });

  it('처음 받은 좌표면 0이다', () => {
    expect(prependedBars(null, 100, prev.span)).toBe(0);
  });
});

describe('nextAway', () => {
  const panned: Transform = { ...HOME, tx: -250 };
  const zoomed: Transform = { ...HOME, k: 3, tx: -500 };

  it('제스처가 기간 범위를 벗어나게 하면 그 제스처를 알린다', () => {
    expect(nextAway(panned, HOME, 'pan', null)).toBe('pan');
    expect(nextAway(zoomed, HOME, 'zoom', null)).toBe('zoom');
  });

  it('제스처 없이 달라지면(좌표 교체 등) 알리지 않는다', () => {
    expect(nextAway(panned, HOME, null, null)).toBeUndefined();
  });

  it('이미 벗어났다고 알렸으면 다시 알리지 않는다', () => {
    expect(nextAway(panned, HOME, 'pan', 'pan')).toBeUndefined();
    expect(nextAway(zoomed, HOME, 'zoom', 'zoom')).toBeUndefined();
  });

  it('기간 범위로 돌아오면 null을 알린다', () => {
    expect(nextAway(HOME, HOME, 'pan', 'pan')).toBeNull();
    expect(nextAway(HOME, HOME, null, 'zoom')).toBeNull();
  });

  it('범위 끝에서 더 밀어 그대로면 알리지 않는다', () => {
    expect(nextAway(HOME, HOME, 'pan', null)).toBeUndefined();
  });

  it('드래그로 벗어난 뒤 핀치로 배율까지 바꾸면 핀치로 올린다', () => {
    expect(nextAway(zoomed, HOME, 'zoom', 'pan')).toBe('zoom');
  });

  it('드래그로 벗어난 뒤 핀치해도 배율이 같으면 드래그로 남긴다', () => {
    expect(nextAway(panned, HOME, 'zoom', 'pan')).toBeUndefined();
  });

  it('핀치로 벗어난 뒤 드래그해도 핀치로 남긴다', () => {
    expect(nextAway(panned, HOME, 'pan', 'zoom')).toBeUndefined();
  });

  it('돌아온 판정은 오차를 허용한다', () => {
    expect(nextAway({ ...HOME, k: 2.0005, tx: -300.0005 }, HOME, 'pan', 'pan')).toBeNull();
  });
});
