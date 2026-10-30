import { envelopeSchema } from '@futureetp/shared';
import { z } from 'zod';
import { perfNow, perfRequest } from '@/lib/perfLog';
import { AppError } from './AppError';
import { getAccessToken } from './accessToken';
import { apiUrl } from './config';

const TIMEOUT_MS = 15_000;

const rawEnvelopeSchema = envelopeSchema(z.unknown());

export type RequestOptions = {
  method?: 'GET' | 'PATCH' | 'PUT';
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  // false면 Authorization 헤더 없이 보낸다(`/v1/health`).
  auth?: boolean;
  // 저장된 키 대신 이 키를 보낸다(B-b에서 저장 전에 키 확인, D-044).
  token?: string;
  // TanStack Query가 넘기는 취소 신호.
  signal?: AbortSignal;
};

// 모든 API 호출의 유일한 경로(D-042). 실패는 모두 AppError로 던진다. 호출자 취소만 원래 오류 그대로 던진다.
export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  options: RequestOptions = {},
): Promise<z.infer<T>> {
  const { method = 'GET', query, body, auth = true, token: tokenOverride, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (auth) {
    const token = tokenOverride ?? (await getAccessToken());
    // 키가 없으면 보내도 401이라 요청하지 않는다(D-072).
    if (!token) throw new AppError('UNAUTHORIZED', { message: 'No access token' });
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  // AbortSignal.timeout·any는 RN 런타임 지원이 불확실해 직접 묶는다(D-072).
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onCallerAbort);

  const t0 = perfNow();
  let tHeaders = t0;
  let res: Response;
  let text: string;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    tHeaders = perfNow();
    text = await res.text();
  } catch (error) {
    if (timedOut)
      throw new AppError('TIMEOUT', { message: `Timed out after ${TIMEOUT_MS}ms`, cause: error });
    if (signal?.aborted) throw error;
    throw new AppError('NETWORK', { message: 'Network request failed', cause: error });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  const tBody = perfNow();
  const json = parseJson(text);
  const tParse = perfNow();
  const envelope = rawEnvelopeSchema.safeParse(json);
  if (!envelope.success) {
    // 프록시 오류(502 HTML 등)처럼 봉투가 아닌 응답은 HTTP 상태로 구분한다(D-042).
    throw new AppError(res.status >= 500 ? 'INTERNAL' : 'SCHEMA_MISMATCH', {
      message: `Unexpected response body (HTTP ${res.status})`,
      status: res.status,
      cause: envelope.error,
    });
  }
  if (!envelope.data.success) {
    const { code, message } = envelope.data.error;
    throw new AppError(code, { message, status: res.status });
  }

  const tEnvelope = perfNow();
  const data = schema.safeParse(envelope.data.data);
  perfRequest(path, text.length, {
    fetch: tHeaders - t0,
    body: tBody - tHeaders,
    parse: tParse - tBody,
    envelope: tEnvelope - tParse,
    schema: perfNow() - tEnvelope,
  });
  if (!data.success) {
    throw new AppError('SCHEMA_MISMATCH', {
      message: `Response data does not match schema: ${path}`,
      status: res.status,
      cause: data.error,
    });
  }
  return data.data;
}

function buildUrl(path: string, query: RequestOptions['query']) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.append(key, String(value));
  }
  const search = params.toString();
  return `${apiUrl}/v1${path}${search ? `?${search}` : ''}`;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
