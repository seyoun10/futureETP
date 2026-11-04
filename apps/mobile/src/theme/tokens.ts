// 테마 토큰(D-031). 다크 전용이라 테마 전환은 없다. Skia 차트도 같은 값을 JS로 읽는다.
export const colors = {
  background: '#000000',
  surface: '#1e1e1e',
  surfaceSelected: '#3a3a6a',
  border: '#2a2a2a',
  // 목록 항목 사이 구분선. border보다 밝게
  separator: '#4a4a4a',
  // title-bar 아래·tab-bar 위 구분선
  barSeparator: '#ffffff',
  // 차트 위에 겹친 정보 줄 배경(뒤의 rare-level 선·격자가 비쳐 보이게)
  overlay: 'rgba(0, 0, 0, 0.65)',
  text: '#e0e0e0',
  textSecondary: '#9e9e9e',
  // 등락 0, 데이터 없음 등 방향이 없는 값
  neutral: '#9e9e9e',
  // 모달 뒤 화면을 어둡게 가리는 배경
  backdrop: 'rgba(0, 0, 0, 0.5)',
  // 오류 안내 문구(B-b 키 거절, B·B-a 저장 실패, rare-level 입력 오류)
  error: '#ef5350',
  // [⚙] 알림 꺼짐 점
  badge: '#ef5350',
  chart: {
    grid: '#2a2a2a',
    tick: '#9e9e9e',
    crosshair: '#ffffff',
    // 십자선 점선은 라벨 상자(흰색)보다 옅게 해 봉·선을 덜 가린다
    crosshairLine: 'rgba(255, 255, 255, 0.6)',
    crosshairText: '#000000',
    // 마지막 봉 종가 라벨·점선(흰색)과 보이는 마지막 봉 종가 라벨·점선(회색)(screens.md C-a)
    lastPrice: '#ffffff',
    currentPrice: '#9e9e9e',
    // 노랑은 이평선 전용(screens.md C-a)
    movingAverage: '#ffd54f',
    // rare-level 선은 레벨 값이 아니라 순위로 고른다. 0 = 가장 덜 드문 레벨(옅음) → 4 = 가장 드문 레벨(진함)
    rareLevels: ['#4a3d66', '#62508a', '#7c62b0', '#9a72d8', '#b884ff'],
    // 롤 표시는 청록(이평선 노랑·rare-level 보라·등락 색과 겹치지 않음). 한국형·미국형 롤 기간 음영, 대표월물 전환일 세로 점선
    rollShade: 'rgba(77, 208, 225, 0.12)',
    rollSwitch: 'rgba(77, 208, 225, 0.45)',
    // 보이는 구간 최고가·최저가 꼬리표
    extremeTag: '#e0e0e0',
    // C-b 커브: 기준일은 흰색 실선, 비교일은 회색 점선(screens.md C-b)
    curveBase: '#ffffff',
    curveCurrent: '#9e9e9e',
    // C-c 월물 선은 만기순 순번으로 고른다. 근월물→원월물을 빨·주·노·초·파 무지개 순서로 읽는다.
    // 6번째는 대표월물 안전장치 월물(D-092)
    contractLines: ['#ef5350', '#ffa726', '#ffee58', '#66bb6a', '#42a5f5', '#90a4ae'],
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const fontSize = {
  caption: 12,
  body: 14,
  title: 17,
  headline: 22,
} as const;

export const radius = {
  sm: 4,
  md: 6,
} as const;

export const size = {
  // 최소 터치 영역(Apple HIG 44pt)
  touchTarget: 44,
} as const;
