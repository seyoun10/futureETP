import { router, useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { HeaderIconButton } from '@/components/HeaderIconButton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsHeaderButton } from '@/features/settings/SettingsHeaderButton';
import { lockLandscape, lockPortrait, useIsLandscape } from '@/lib/orientation';
import { useCommodityCode } from './useCommodityCode';

// C title-bar: [←] 원자재명 / 심볼 [회전] [⚙]. [←]는 탭 이력과 상관없이 A로 간다(screens.md C).
// [회전]은 C-a~C-c에서만 보이고, 바뀔 방향의 휴대폰 회전 아이콘이다(↻ 되돌리기와 구분). 가로 모드에서는 높이를 줄인다(D-076).
export function CommodityTitleBar() {
  const { t } = useTranslation();
  const code = useCommodityCode();
  const title = code ? `${t(`commodities.${code}`)} / ${code}` : '';
  const segments = useSegments();
  const isLandscape = useIsLandscape();
  const canRotate = segments.at(-1) !== 'etps';

  return (
    <ScreenHeader
      title={title}
      compact={isLandscape}
      onBack={() => router.dismissTo('/')}
      right={
        <>
          {canRotate ? (
            <HeaderIconButton
              icon={isLandscape ? 'phone-rotate-portrait' : 'phone-rotate-landscape'}
              label={t('commodity.rotate')}
              compact={isLandscape}
              onPress={() => void (isLandscape ? lockPortrait() : lockLandscape())}
            />
          ) : null}
          <SettingsHeaderButton compact={isLandscape} />
        </>
      }
    />
  );
}
