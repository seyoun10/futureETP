import { getItem, setItemAsync } from 'expo-secure-store';
import { create } from 'zustand';
import { devApiToken } from './config';

// QR 내용 접두사와 키 형식(D-044): 32바이트 난수 base64url(패딩 없음) = 43자.
export const ACCESS_KEY_QR_PREFIX = 'futureetp-key:v1:';
const KEY_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const STORE_KEY = 'access-key';

// QR은 접두사가 있어야 받고, 붙여넣기는 키만 넣어도 받는다. 형식이 아니면 null.
export function parseAccessKey(input: string, { requirePrefix = false } = {}): string | null {
  const text = input.trim();
  const hasPrefix = text.startsWith(ACCESS_KEY_QR_PREFIX);
  if (requirePrefix && !hasPrefix) return null;
  const key = hasPrefix ? text.slice(ACCESS_KEY_QR_PREFIX.length) : text;
  return KEY_PATTERN.test(key) ? key : null;
}

// 저장된 키는 앱 시작 때 한 번 동기로 읽어 메모리에 둔다. 저장된 키가 없으면 dev 변형만 DEV_API_TOKEN.
// 읽기 실패(기기 키 저장소 손상 등)는 키 없음으로 보고 B-b에서 다시 넣게 한다.
function readStoredKey() {
  try {
    return getItem(STORE_KEY);
  } catch {
    return null;
  }
}

export const useAccessKeyStore = create<{ key: string | null }>(() => ({
  key: readStoredKey() ?? devApiToken,
}));

export const useHasAccessKey = () => useAccessKeyStore((state) => state.key !== null);

// 서버 접근 키를 읽는 유일한 곳(D-072).
export function getAccessToken(): Promise<string | null> {
  return Promise.resolve(useAccessKeyStore.getState().key);
}

// 서버에서 확인한 키만 넘긴다(D-044). 저장에 성공해야 메모리 값도 바꾼다.
export async function saveAccessToken(key: string) {
  await setItemAsync(STORE_KEY, key);
  useAccessKeyStore.setState({ key });
}
