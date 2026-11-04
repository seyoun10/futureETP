// 토큰이 있는 모든 기기로 보낸다(D-023, D-037). 문구는 기기별 언어로 만든다(D-120).
// 무효 토큰이면 그 기기의 토큰을 비운다(설정은 남김, D-120).
import type { Locale } from '@futureetp/shared';
import type { PushMessage, PushSender, PushTarget, SendResult } from './sender.ts';

export type PushDevice = PushTarget & { id: string; locale: Locale };

export interface PushDeviceStore {
  // 토큰이 있는 기기만
  list(): Promise<PushDevice[]>;
  clearToken(id: string): Promise<void>;
}

export type PushDeps = { store: PushDeviceStore; sender: PushSender };

export type BroadcastResult = {
  // 보낸 기기 수(무효 토큰으로 비운 기기 포함)
  devices: number;
  sent: number;
  cleared: number;
  // 실패한 기기별 사유
  failures: string[];
};

// 한 기기라도 성공했는가. 모두 실패하면 rare 알림은 RETRY, 다시 실패하면 FAILED다(D-023).
export const delivered = (result: BroadcastResult) => result.sent > 0;

// 한 기기로 보낸다. 발송기가 던지면 FAILED로 바꾸고, 무효 토큰이면 토큰을 비운다.
export async function sendToDevice(
  deps: PushDeps,
  device: PushTarget & { id: string },
  message: PushMessage,
): Promise<SendResult> {
  let result: SendResult;
  try {
    result = await deps.sender.send(device, message);
  } catch (error) {
    result = { status: 'FAILED', error: error instanceof Error ? error.message : String(error) };
  }
  if (result.status === 'INVALID_TOKEN') await deps.store.clearToken(device.id);
  return result;
}

export async function broadcast(
  deps: PushDeps,
  message: (device: PushDevice) => PushMessage,
): Promise<BroadcastResult> {
  const devices = await deps.store.list();
  const result: BroadcastResult = { devices: devices.length, sent: 0, cleared: 0, failures: [] };
  for (const device of devices) {
    const sendResult = await sendToDevice(deps, device, message(device));
    if (sendResult.status === 'SENT') result.sent++;
    else if (sendResult.status === 'INVALID_TOKEN') result.cleared++;
    else result.failures.push(`${device.platform} ${device.id}: ${sendResult.error}`);
  }
  return result;
}
