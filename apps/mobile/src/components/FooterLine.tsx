import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, spacing } from '@/theme/tokens';

// 줄 높이를 최소로 둔다(글자 높이 + 위아래 1pt)
const LINE_HEIGHT = fontSize.caption + 2;
const LINE_BLOCK = LINE_HEIGHT + 2;

// 화면 최하단 안내 한 줄(A·C 기준 시각 줄, B 앱 번들 줄). 높이를 아끼려고 홈 인디케이터 여백 위쪽에 겹쳐 둔다(여백 34pt면
// 줄 아래 18pt, 인디케이터는 맨 아래 약 13pt 안). 내용이 없어도 같은 Text로 빈 줄을 그려 위의 tab-bar가 흔들리거나
// 탭마다 위치가 달라지지 않게 한다. 높이를 숫자로 고정하면 기기 글자 크기에 따라 실제 줄 높이와 어긋난다
export function FooterLine({ children }: { children?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom - LINE_BLOCK, 0) }]}>
      {children ?? <FooterText>{' '}</FooterText>}
    </View>
  );
}

export function FooterText({ children }: { children: string }) {
  return (
    <Text style={styles.text} numberOfLines={1}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: colors.background,
  },
  text: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 1,
    lineHeight: LINE_HEIGHT,
    color: colors.textSecondary,
    fontSize: fontSize.caption,
    textAlign: 'center',
  },
});
