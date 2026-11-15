// 외부 소스 HTTP 조회 공통. 소스별 throttle·재시도(429)는 각 소스가 이 위에서 한다.

export type RequestOptions = {
  timeoutMs: number;
  headers?: Record<string, string>;
};

export type JsonOptions = RequestOptions & {
  // 오류 문구 앞부분(예: 'Yahoo SPY')
  label: string;
  // 실패 응답 본문을 오류 문구에 붙인다
  withBody?: boolean;
};

// 타임아웃 signal을 붙여 요청한다
export function request(
  fetchFn: typeof fetch,
  url: string,
  { timeoutMs, headers }: RequestOptions,
): Promise<Response> {
  return fetchFn(url, {
    ...(headers === undefined ? {} : { headers }),
    signal: AbortSignal.timeout(timeoutMs),
  });
}

// 2xx가 아니면 `${label}: HTTP ${status}`로 던지고, 맞으면 JSON 본문
export async function readJson(
  response: Response,
  { label, withBody = false }: Pick<JsonOptions, 'label' | 'withBody'>,
): Promise<unknown> {
  if (!response.ok) {
    const detail = withBody ? ` ${await response.text()}` : '';
    throw new Error(`${label}: HTTP ${response.status}${detail}`);
  }
  return response.json();
}

export async function fetchJson(
  fetchFn: typeof fetch,
  url: string,
  options: JsonOptions,
): Promise<unknown> {
  return readJson(await request(fetchFn, url, options), options);
}

// fetchJson과 같되 404(만기·없는 심볼 등)는 null
export async function fetchJsonOrNull(
  fetchFn: typeof fetch,
  url: string,
  options: JsonOptions,
): Promise<unknown> {
  const response = await request(fetchFn, url, options);
  if (response.status === 404) return null;
  return readJson(response, options);
}
