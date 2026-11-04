import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { colors } from '@/theme/tokens';

export type OverlayInsets = { top: number; bottom: number };

type Props = {
  // 차트 위쪽에 겹치는 정보 줄
  top?: ReactNode;
  // 차트 바닥에서 띄우는 거리(x축 라벨 자리). 세 차트 탭이 같은 값이라 floating 위치가 같다
  bottomOffset: number;
  // x축 라벨 바로 위에 띄우는 버튼(차트 되돌리기). 높이를 재지 않아 나타나도 데이터가 움직이지 않는다
  floating?: ReactNode;
  // 정보 줄 높이가 바뀔 때. 차트는 이 높이만큼 데이터를 비켜 그린다(아래는 정보 줄이 없어 0)
  onInsets: (insets: OverlayInsets) => void;
};

// 차트 영역 안쪽에 겹쳐 그리는 정보 줄(screens.md C-a·C-b). 차트는 상하단 바 사이 전체를 쓰고,
// 정보 줄은 반투명 배경으로 위쪽에만 올린다. 줄 밖 빈 곳의 터치는 차트로 간다.
export function ChartOverlay({ top, bottomOffset, floating, onInsets }: Props) {
  const [topInset, setTopInset] = useState(0);
  const measure = (e: LayoutChangeEvent) => {
    const height = Math.round(e.nativeEvent.layout.height);
    if (topInset === height) return;
    setTopInset(height);
    onInsets({ top: height, bottom: 0 });
  };

  return (
    <>
      {top !== undefined && (
        <View style={[styles.band, styles.top]} pointerEvents="box-none" onLayout={measure}>
          {top}
        </View>
      )}
      {floating !== undefined && (
        <View style={[styles.floating, { bottom: bottomOffset }]} pointerEvents="box-none">
          {floating}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.overlay,
  },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  floating: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 8,
  },
});
