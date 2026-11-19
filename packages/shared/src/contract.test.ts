import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildContract } from './contract.ts';

const contractDir = join(import.meta.dirname, '..', 'contract');

describe('API 계약 파일(D-141)', () => {
  const files = buildContract();

  it('커밋된 파일이 스키마와 같다(다르면 npm run contract:export)', () => {
    for (const [path, content] of files) {
      expect(readFileSync(join(contractDir, path), 'utf8'), path).toBe(content);
    }
  });

  it('스키마에 없는 파일이 남아 있지 않다', () => {
    const onDisk = readdirSync(join(contractDir, 'schemas')).map((name) => `schemas/${name}`);
    expect(onDisk.sort()).toEqual([...files.keys()].filter((p) => p.startsWith('schemas/')).sort());
  });

  it('엔드포인트가 가리키는 스키마 파일이 모두 있다', () => {
    const api = JSON.parse(files.get('api.json')!) as {
      endpoints: { query?: string; body?: string; data: string }[];
    };
    const refs = api.endpoints.flatMap((e) => [e.query, e.body, e.data]).filter((r) => r);
    for (const ref of refs) expect(files.has(ref!), ref).toBe(true);
  });

  it('응답 data 스키마는 필수 필드와 nullable을 그대로 담는다', () => {
    const device = JSON.parse(files.get('schemas/deviceRegistration.json')!) as {
      required: string[];
      additionalProperties: boolean;
      properties: { appVersion: { anyOf: unknown[] } };
    };
    expect(device.required).toEqual(['pushToken', 'platform', 'appVersion']);
    // strictObject는 모르는 필드를 거절한다
    expect(device.additionalProperties).toBe(false);
    expect(device.properties.appVersion.anyOf).toContainEqual({ type: 'null' });
  });
});
