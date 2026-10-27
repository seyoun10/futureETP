import { devApiToken } from './config';

// 서버 접근 키를 읽는 유일한 곳. SecureStore 저장(D-044) 전까지는 dev 변형의 토큰만 쓴다.
export function getAccessToken(): Promise<string | null> {
  return Promise.resolve(devApiToken);
}
