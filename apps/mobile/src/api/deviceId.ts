import { getItem, setItem } from 'expo-secure-store';

// 기기 키(installation ID, D-120). 서버가 설정·알림을 이 값으로 기기별로 나눈다.
// 접근 키와 따로 두어 키를 바꿔도 설정이 남는다. 앱을 지우면 새 기기가 된다.
const STORE_KEY = 'device-id';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// RN 런타임에 crypto.randomUUID·getRandomValues가 없다. 기기 구분용이라 비밀이 아니고
// 서버 접근은 Bearer 키가 막으므로 Math.random으로 충분하다(네이티브 의존성을 늘리지 않음).
export function createUuidV4(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

let cached: string | null = null;

// 처음 부를 때 저장된 값을 읽고, 없거나 형식이 아니면 새로 만들어 저장한다.
// 저장소 읽기·쓰기가 실패해도 이번 실행은 만든 값을 쓴다(다음 실행은 새 기기로 보임).
export function getDeviceId(): string {
  if (cached) return cached;
  let stored: string | null = null;
  try {
    stored = getItem(STORE_KEY);
  } catch {
    stored = null;
  }
  if (stored && UUID_PATTERN.test(stored)) {
    cached = stored;
    return stored;
  }
  const id = createUuidV4();
  try {
    setItem(STORE_KEY, id);
  } catch (error) {
    console.warn('[device] failed to save device id', error);
  }
  cached = id;
  return id;
}

// 테스트에서 메모리 값을 지운다.
export function resetDeviceIdCache() {
  cached = null;
}
