import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

const SetBusyContext = createContext<(busy: boolean) => void>(() => {});

// C 원자재 화면에서 차트가 이전 3년을 받는 동안 title-bar·tab-bar·기간 칩까지 모든 터치를 막는다(D-139).
// 투명이라 차트 위 로딩 표시는 보인다. 차트 안 제스처는 차트의 locked가 따로 멈춘다(D-108).
// Android 시스템 뒤로 버튼은 OS 동작이라 막지 않는다
export function ChartBusyProvider({ children }: { children: ReactNode }) {
  const [busy, setBusy] = useState(false);

  return (
    <SetBusyContext value={setBusy}>
      <View style={styles.container}>
        {children}
        {busy && (
          <View
            testID="chart-busy-blocker"
            style={StyleSheet.absoluteFill}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}
      </View>
    </SetBusyContext>
  );
}

// 탭 화면이 받는 중임을 알린다. 끝나거나 화면이 사라지면 푼다
export function useReportChartBusy(busy: boolean) {
  const setBusy = useContext(SetBusyContext);
  useEffect(() => {
    if (!busy) return;
    setBusy(true);
    return () => setBusy(false);
  }, [busy, setBusy]);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
