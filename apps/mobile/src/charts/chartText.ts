import { FontHinting, matchFont, Skia } from '@shopify/react-native-skia';
import type { SkParagraph } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

// 차트 캔버스 글자(D-087). 숫자만 쓰는 축·십자선 라벨은 matchFont로 빠르게 그리고,
// 한글이 들어가는 글자는 Paragraph로 그린다. matchFont는 시스템 대체 글꼴을 쓰지 않아 한글이 □로 나오지만
// Paragraph는 시스템 글꼴 관리자 + 대체 글꼴을 켜고 만든다(react-native-skia JsiSkParagraphBuilder).
export const CHART_FONT_SIZE = 11;

export const numberFont = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: CHART_FONT_SIZE,
});
// 기본값은 글자 위치를 정수 픽셀로 반올림해 작은 글자에서 `J AN27`처럼 간격이 벌어진다
numberFont.setSubpixel(true);
numberFont.setLinearMetrics(true);
numberFont.setHinting(FontHinting.None);

// <Paragraph width>도 이 값으로 준다. 그리는 쪽이 글자 너비로 다시 layout하면 캐시된 문단이 줄바꿈된 채 남고,
// 그다음 getLongestLine()이 줄바꿈된 너비를 돌려줘 계속 여러 줄로 그려진다(이격도 차트 고가 꼬리표)
export const PARAGRAPH_LAYOUT_WIDTH = 10_000;

// 제스처 중 같은 글자를 매 프레임 다시 만들지 않게 글자·색별로 둔다
const MAX_CACHED = 300;
const cache = new Map<string, SkParagraph>();

export function chartParagraph(text: string, color: string): SkParagraph {
  const key = `${color}\u0000${text}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const paragraph = Skia.ParagraphBuilder.Make({
    textStyle: { color: Skia.Color(color), fontSize: CHART_FONT_SIZE },
  })
    .addText(text)
    .build();
  // 한 줄로 두고 실제 너비는 getLongestLine()으로 읽는다
  paragraph.layout(PARAGRAPH_LAYOUT_WIDTH);
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value as string);
  cache.set(key, paragraph);
  return paragraph;
}
