import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { colors, fontSize } from '@/theme/tokens';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type Props = {
  name: IconName;
  size?: number;
  color?: string;
};

// 버튼 아이콘(Material Community Icons, expo-font로 런타임 로드). 기본은 title-bar 아이콘 크기·본문 색
export function Icon({ name, size = fontSize.headline, color = colors.text }: Props) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
