// API 계약을 JSON Schema 파일로 내보낸다(D-141). 형제 저장소(Flutter·Swift·Kotlin 앱)가 TS 스키마 대신 읽는다.
// 파일은 `packages/shared/contract/`에 커밋하고, `npm run contract:export`로 다시 만든다.
// 커밋된 파일이 스키마와 어긋나면 `contract.test.ts`가 실패한다(npm run check).
import { z } from 'zod';
import { commoditiesSchema } from './commodities.ts';
import { contractsChartSchema } from './contracts.ts';
import { curveSchema } from './curve.ts';
import { DEVICE_ID_HEADER, deviceRegistrationSchema, deviceSchema } from './devices.ts';
import { disparityChartSchema } from './disparity.ts';
import { BASES, COMMODITY_CODES, MA_PERIODS, WINDOWS } from './domain.ts';
import { API_ERROR_CODES, errorSchema } from './envelope.ts';
import { etpDetailSchema, etpListSchema } from './etps.ts';
import { settingsPatchSchema, settingsSchema } from './settings.ts';

// 서버 라우트(apps/server/src/api)의 query 검증과 같은 값. 쿼리는 문자열로 보내므로 문서용이다
const isoDate = z.iso.date();
const disparityQuerySchema = z.object({
  basis: z.enum(BASES),
  ma: z.enum(MA_PERIODS.map(String)),
  window: z.enum(WINDOWS),
  levels: z
    .string()
    .describe('rare 레벨 5개를 쉼표로(예: 1,2.5,5,10,20). 설정 rareLevels와 같은 규칙'),
  before: isoDate.optional().describe('이 거래일보다 이른 봉만(이전 3년 더 받기, D-104)'),
});
const contractsQuerySchema = z.object({
  before: isoDate.optional().describe('이 거래일보다 이른 날짜만(이전 3년 더 받기, D-104)'),
});
const curveQuerySchema = z.object({
  baseDate: isoDate.optional().describe('기준일. 서버가 거래일로 맞춘다(D-090)'),
});
// 서버 app.ts의 health 응답. shared 스키마가 없어 여기서만 정의한다
const healthSchema = z.object({ status: z.literal('ok'), commit: z.string().nullable() });

// 응답 data·요청 본문·쿼리 스키마. 이름이 파일 이름(`schemas/<이름>.json`)이 된다
const SCHEMAS = {
  health: healthSchema,
  commodities: commoditiesSchema,
  disparityChart: disparityChartSchema,
  disparityQuery: disparityQuerySchema,
  curve: curveSchema,
  curveQuery: curveQuerySchema,
  contractsChart: contractsChartSchema,
  contractsQuery: contractsQuerySchema,
  etpList: etpListSchema,
  etpDetail: etpDetailSchema,
  settings: settingsSchema,
  settingsPatch: settingsPatchSchema,
  deviceRegistration: deviceRegistrationSchema,
  device: deviceSchema,
  error: errorSchema,
} as const;
type SchemaName = keyof typeof SCHEMAS;

type Endpoint = {
  method: 'GET' | 'PUT' | 'PATCH';
  path: string;
  // false면 인증·기기 헤더 없이 부른다
  auth: boolean;
  query?: SchemaName;
  body?: SchemaName;
  // 성공 응답 봉투의 data
  data: SchemaName;
};

// docs/architecture.md "엔드포인트 초안"과 같은 목록
const ENDPOINTS: readonly Endpoint[] = [
  { method: 'GET', path: '/v1/health', auth: false, data: 'health' },
  { method: 'GET', path: '/v1/commodities', auth: true, data: 'commodities' },
  {
    method: 'GET',
    path: '/v1/commodities/{code}/disparity',
    auth: true,
    query: 'disparityQuery',
    data: 'disparityChart',
  },
  {
    method: 'GET',
    path: '/v1/commodities/{code}/curve',
    auth: true,
    query: 'curveQuery',
    data: 'curve',
  },
  {
    method: 'GET',
    path: '/v1/commodities/{code}/contracts',
    auth: true,
    query: 'contractsQuery',
    data: 'contractsChart',
  },
  { method: 'GET', path: '/v1/commodities/{code}/etps', auth: true, data: 'etpList' },
  { method: 'GET', path: '/v1/etps/{id}', auth: true, data: 'etpDetail' },
  { method: 'GET', path: '/v1/settings', auth: true, data: 'settings' },
  { method: 'PATCH', path: '/v1/settings', auth: true, body: 'settingsPatch', data: 'settings' },
  { method: 'PUT', path: '/v1/devices', auth: true, body: 'deviceRegistration', data: 'device' },
];

const ERROR_HTTP_STATUS = {
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  INTERNAL: 500,
} as const satisfies Record<(typeof API_ERROR_CODES)[number], number>;

const toJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

// 내보낼 파일들: contract/ 기준 상대경로 → 내용
export function buildContract(): Map<string, string> {
  const files = new Map<string, string>();
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    // 앱이 받는 JSON(응답)과 보내는 JSON(본문)은 모두 스키마의 입력 쪽이다.
    // refine(날짜 순서·중복 없음 등)은 JSON Schema로 표현되지 않아 빠진다
    const jsonSchema = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
    files.set(`schemas/${name}.json`, toJson({ ...jsonSchema, title: name }));
  }
  files.set(
    'api.json',
    toJson({
      description:
        'futureETP API 계약(D-141). 생성 파일이니 고치지 말고 `npm run contract:export`로 다시 만든다. 규약 설명은 docs/architecture.md "API 통신 및 에러 처리 규약".',
      basePath: '/v1',
      headers: {
        Authorization: 'Bearer <접근 키>',
        [DEVICE_ID_HEADER]: '<installation ID, UUID v4>',
      },
      envelope: {
        success: '{ "success": true, "data": <data 스키마> }',
        failure: '{ "success": false, "error": <schemas/error.json> }',
      },
      pathParams: { code: [...COMMODITY_CODES], id: 'UUID' },
      errorCodes: ERROR_HTTP_STATUS,
      endpoints: ENDPOINTS.map((e) => ({
        ...e,
        ...(e.query && { query: `schemas/${e.query}.json` }),
        ...(e.body && { body: `schemas/${e.body}.json` }),
        data: `schemas/${e.data}.json`,
      })),
    }),
  );
  return files;
}
