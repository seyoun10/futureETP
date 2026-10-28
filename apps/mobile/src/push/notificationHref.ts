import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';

// 서버가 알림 data에 넣는 type(jobs/rareAlert.ts·opsAlert.ts·etpCandidateAlert.ts)으로 탭했을 때 갈 화면을 고른다(screens.md X).
// rare 레벨 알림은 그 원자재의 C-a, 운영·ETP 새 후보(D-025)·모르는 알림은 A로 간다.
export function notificationHref(data: Record<string, unknown> | null | undefined) {
  const commodity = data?.commodity;
  if (data?.type === 'RARE_LEVEL' && isCommodityCode(commodity)) {
    return `/commodity/${commodity}` as const;
  }
  return '/' as const;
}

function isCommodityCode(value: unknown): value is CommodityCode {
  return COMMODITY_CODES.includes(value as CommodityCode);
}
