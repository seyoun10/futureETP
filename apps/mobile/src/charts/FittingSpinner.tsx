import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { CenterSpinner } from '@/components/CenterSpinner';

// 데이터는 왔지만 첫 기간 맞춤 전이라 차트를 감춘 동안 차트 자리 가운데에 띄우는 스피너.
// 보이기는 useChartViewport의 fittingStyle(UI 스레드)이 정하고, 터치는 막지 않는다
export function FittingSpinner({ style }: { style: AnimatedStyle<ViewStyle> }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <CenterSpinner />
    </Animated.View>
  );
}
