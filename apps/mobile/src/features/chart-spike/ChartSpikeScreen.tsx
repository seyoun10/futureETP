import { matchFont } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CartesianChart, Candlestick } from 'victory-native';

import { makeSyntheticBars } from './syntheticBars';

// C-a 차트 스파이크(D-032). 검증용 화면이라 테마 토큰·i18n은 붙이지 않는다.
const BAR_COUNT = 4000;

const font = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: 11,
});

export function ChartSpikeScreen() {
  const bars = useMemo(() => makeSyntheticBars(BAR_COUNT), []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>C-a spike · {bars.length} bars</Text>
      <View style={styles.chart}>
        <CartesianChart
          data={bars}
          xKey="i"
          yKeys={['open', 'high', 'low', 'close']}
          axisOptions={{ axisScales: { yAxisScale: 'log' } }}
          xAxis={{
            font,
            labelColor: '#9e9e9e',
            lineColor: '#2a2a2a',
            tickCount: 5,
            formatXLabel: (i) => bars[Math.round(i)]?.date.slice(0, 7) ?? '',
          }}
          yAxis={[
            {
              font,
              axisSide: 'right',
              labelColor: '#9e9e9e',
              lineColor: '#2a2a2a',
              tickCount: 6,
              formatYLabel: (v) => v.toFixed(2),
            },
          ]}
        >
          {({ points, chartBounds }) => (
            <Candlestick
              openPoints={points.open}
              highPoints={points.high}
              lowPoints={points.low}
              closePoints={points.close}
              chartBounds={chartBounds}
              candleColors={{ positive: '#ef5350', negative: '#42a5f5' }}
              // 0 = Skia 헤어라인: 변환 행렬로 확대해도 꼬리가 1px로 유지된다.
              wickStrokeWidth={0}
            />
          )}
        </CartesianChart>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  title: {
    color: '#e0e0e0',
    fontSize: 14,
    padding: 12,
  },
  chart: {
    flex: 1,
    paddingBottom: 16,
  },
});
