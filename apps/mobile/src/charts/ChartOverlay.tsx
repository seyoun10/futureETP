import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { colors } from '@/theme/tokens';

export type OverlayInsets = { top: number; bottom: number };

type Props = {
  // 차트 위쪽에 겹치는 정보 줄
  top?: ReactNode;
  // 차트 아래쪽에 겹치는 정보 줄. bottomOffset만큼 차트 바닥에서 띄운다(x축 라벨 위)
  bottom?: ReactNode;
  bottomOffset: number;
  // 아래 정보 줄 바로 위에 띄우는 버튼(차트 되돌리기). 높이를 재지 않아 나타나도 데이터가 움직이지 않는다
  floating?: ReactNode;
  // 정보 줄 높이가 바뀔 때. 차트는 이 높이만큼 데이터를 비켜 그린다
  onInsets: (insets: OverlayInsets) => void;
};

// 차트 영역 안쪽에 겹쳐 그리는 정보 줄(screens.md C-a·C-b). 차트는 상하단 바 사이 전체를 쓰고,
// 정보 줄은 반투명 배경으로 올린다. 줄 밖 빈 곳의 터치는 차트로 간다.
export function ChartOverlay({ top, bottom, bottomOffset, floating, onInsets }: Props) {
  const [insets, setInsets] = useState<OverlayInsets>({ top: 0, bottom: 0 });
  const measure = (key: keyof OverlayInsets) => (e: LayoutChangeEvent) => {
    const height = Math.round(e.nativeEvent.layout.height);
    if (insets[key] === height) return;
    const next = { ...insets, [key]: height };
    setInsets(next);
    onInsets(next);
  };

  return (
    <>
      {top !== undefined && (
        <View style={[styles.band, styles.top]} pointerEvents="box-none" onLayout={measure('top')}>
          {top}
        </View>
      )}
      <View style={[styles.bottomArea, { bottom: bottomOffset }]} pointerEvents="box-none">
        {floating !== undefined && (
          <View style={styles.floating} pointerEvents="box-none">
            {floating}
          </View>
        )}
        {bottom !== undefined && (
          <View style={styles.band} pointerEvents="box-none" onLayout={measure('bottom')}>
            {bottom}
          </View>
        )}
      </View>
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
  bottomArea: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  floating: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: 8,
  },
});
