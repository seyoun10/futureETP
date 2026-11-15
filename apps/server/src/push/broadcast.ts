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

export type OpsBroadcastOptions = {
  // 미전달 로그 앞부분(예: '[etp candidates] AAA, BBB')
  label: string;
  log: (message: string) => void;
  // 한 기기라도 전달했을 때(알림 표시 기록 등)
  onDelivered: () => Promise<void>;
  // 한 기기에도 전달하지 못했을 때. 표시하지 않아 다음에 다시 보낸다
  onUndelivered?: () => Promise<void>;
};

// 운영 알림(ops 채널, D-045)을 모든 기기로 보낸다. 미전달이면 로그를 남기고 UNDELIVERED다.
export async function broadcastOps(
  deps: PushDeps,
  message: (device: PushDevice) => Omit<PushMessage, 'channel'>,
  options: OpsBroadcastOptions,
): Promise<'SENT' | 'UNDELIVERED'> {
  const result = await broadcast(deps, (device) => ({ ...message(device), channel: 'ops' }));
  if (!delivered(result)) {
    await options.onUndelivered?.();
    options.log(
      `${options.label} not delivered to ${result.devices} device(s): ${result.failures.join('; ')}`,
    );
    return 'UNDELIVERED';
  }
  await options.onDelivered();
  return 'SENT';
}
