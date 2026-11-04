// ETP 작업 끝의 다수 판정 재계산(D-015, D-024). 상장 중·확인 완료 상품으로 원자재·기준값마다 다수 규칙을 판정해
// roll_rule.majority_rule_id에 기록한다. 적용 중인 rule_id와 다르고 직전 기록과도 다르면 한 건으로 묶어 알린다.
// 반영은 사람이 roll_rule 행을 바꿔서 하므로 운영 알림처럼 ops 채널로 보내고, 누르면 A로 간다(D-025).
// 한 기기에도 전달하지 못하면 바뀐 판정은 기록하지 않아 다음 ETP 작업 때 다시 보낸다.
// 셀 상품이 없으면(순자산을 아직 못 받음 등) 직전 기록을 둔다.
import { majorityChangedPush, type CommodityCode, type MajorityChange } from '@futureetp/shared';
import { krRuleId, majorityRules, type MajorityProduct } from '../calc/majorityRule.ts';
import { broadcast, delivered, type PushDeviceStore } from '../push/broadcast.ts';
import type { PushSender } from '../push/sender.ts';

export type MajorityEtp = Omit<MajorityProduct, 'ruleId'> & {
  underlyingIndex: string | null;
  // 미국 매핑표 규칙(국내는 null)
  rollRuleRef: string | null;
};

export type RollRuleState = {
  commodityCode: CommodityCode;
  basis: MajorityChange['basis'];
  ruleId: string;
  majorityRuleId: string | null;
};

export type MajorityUpdate = Pick<RollRuleState, 'commodityCode' | 'basis' | 'majorityRuleId'>;

export interface MajorityAlertStore {
  // 상장 중(is_active)·확인 완료(needs_review 아님) 상품
  majorityEtps(): Promise<MajorityEtp[]>;
  rollRules(): Promise<RollRuleState[]>;
  setMajority(updates: readonly MajorityUpdate[], checkedAt: Date): Promise<void>;
}

export type MajorityAlertOutcome = 'NONE' | 'SENT' | 'UNDELIVERED';

const ruleIdOf = (etp: MajorityEtp) =>
  etp.market === 'KRX' ? krRuleId(etp.underlyingIndex) : etp.rollRuleRef;

export function createMajorityAlert(deps: {
  store: MajorityAlertStore;
  devices: PushDeviceStore;
  sender: PushSender;
  log?: (message: string) => void;
}) {
  const log = deps.log ?? console.log;
  return async (now: Date): Promise<MajorityAlertOutcome> => {
    const etps = await deps.store.majorityEtps();
    const results = majorityRules(etps.map((etp) => ({ ...etp, ruleId: ruleIdOf(etp) })));
    const resultByKey = new Map(
      results.map((result) => [
        `${result.commodityCode}|${result.market === 'KRX' ? 'KR' : 'US'}`,
        result,
      ]),
    );

    const updates: MajorityUpdate[] = [];
    const changes: MajorityChange[] = [];
    for (const rule of await deps.store.rollRules()) {
      const result = resultByKey.get(`${rule.commodityCode}|${rule.basis}`);
      if (!result?.ruleId) {
        log(`[etp majority] ${rule.commodityCode} ${rule.basis}: no countable ETPs, kept`);
        continue;
      }
      log(
        `[etp majority] ${rule.commodityCode} ${rule.basis}: ${result.ruleId} ${JSON.stringify(result.counts)}`,
      );
      if (result.ruleId !== rule.ruleId && result.ruleId !== rule.majorityRuleId) {
        changes.push({
          commodity: rule.commodityCode,
          basis: rule.basis,
          ruleId: rule.ruleId,
          majorityRuleId: result.ruleId,
        });
      } else {
        updates.push({
          commodityCode: rule.commodityCode,
          basis: rule.basis,
          majorityRuleId: result.ruleId,
        });
      }
    }
    if (changes.length === 0) {
      await deps.store.setMajority(updates, now);
      return 'NONE';
    }

    const result = await broadcast({ store: deps.devices, sender: deps.sender }, (device) => ({
      text: majorityChangedPush(device.locale, changes),
      channel: 'ops',
      data: { type: 'MAJORITY_CHANGED' },
    }));
    // 로그는 영문 문구로 남긴다
    const text = majorityChangedPush('en', changes);
    if (!delivered(result)) {
      await deps.store.setMajority(updates, now);
      log(
        `[etp majority] ${text.body} not delivered to ${result.devices} device(s): ` +
          result.failures.join('; '),
      );
      return 'UNDELIVERED';
    }
    await deps.store.setMajority(
      [
        ...updates,
        ...changes.map((change) => ({
          commodityCode: change.commodity,
          basis: change.basis,
          majorityRuleId: change.majorityRuleId,
        })),
      ],
      now,
    );
    log(`[etp majority] notified ${text.body}`);
    return 'SENT';
  };
}

export type MajorityAlert = ReturnType<typeof createMajorityAlert>;
