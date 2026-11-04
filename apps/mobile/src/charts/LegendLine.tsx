import { StyleSheet, View } from 'react-native';

// 범례 줄 앞 선 견본. 점선도 실선과 길이가 같게 마디를 View로 그린다(글자 ╌·─는 글꼴마다 폭이 달라 어긋났다)
export const LEGEND_LINE_WIDTH = 18;

type Props = {
  color: string;
  // 점선의 선·빈칸 길이(차트 DashPathEffect intervals와 같은 값). 없으면 실선
  dash?: readonly [number, number];
  strokeWidth?: number;
};

export function LegendLine({ color, dash, strokeWidth = 2 }: Props) {
  if (!dash) {
    return <View style={[styles.line, { height: strokeWidth, backgroundColor: color }]} />;
  }
  const [on, off] = dash;
  const count = Math.max(1, Math.floor((LEGEND_LINE_WIDTH + off) / (on + off)));
  return (
    <View style={[styles.line, styles.dashed, { height: strokeWidth }]}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ width: on, height: strokeWidth, backgroundColor: color }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    width: LEGEND_LINE_WIDTH,
  },
  dashed: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
