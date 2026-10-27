import { describe, expect, it } from 'vitest';
import { parseConfig } from './config.ts';

const validEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@db:5432/futureetp',
  API_TOKEN: 'a'.repeat(32),
  SCHEDULER_ENABLED: 'true',
};

describe('parseConfig', () => {
  it('필수 값만 있으면 기본값을 채운다', () => {
    const config = parseConfig(validEnv);
    expect(config).toMatchObject({
      NODE_ENV: 'production',
      PORT: 3000,
      LOG_LEVEL: 'info',
      SCHEDULER_ENABLED: true,
    });
    expect(config.DATABENTO_API_KEY).toBeUndefined();
  });

  it('PORT 문자열을 숫자로 바꾼다', () => {
    expect(parseConfig({ ...validEnv, PORT: '8080' }).PORT).toBe(8080);
  });

  it.each([
    ['true', true],
    ['false', false],
    ['1', true],
    ['0', false],
  ])('SCHEDULER_ENABLED=%s → %s', (raw, expected) => {
    expect(parseConfig({ ...validEnv, SCHEDULER_ENABLED: raw }).SCHEDULER_ENABLED).toBe(expected);
  });

  it('선택 키의 빈 문자열은 미설정으로 본다', () => {
    const config = parseConfig({ ...validEnv, MASSIVE_API_KEY: '', BACKUP_DIR: '/backup' });
    expect(config.MASSIVE_API_KEY).toBeUndefined();
    expect(config.BACKUP_DIR).toBe('/backup');
  });

  it('필수 값이 없으면 항목 이름을 담아 실패한다', () => {
    expect(() => parseConfig({})).toThrow(
      /NODE_ENV[\s\S]*DATABASE_URL[\s\S]*API_TOKEN[\s\S]*SCHEDULER_ENABLED/,
    );
  });

  it.each([
    ['NODE_ENV', 'test'],
    ['DATABASE_URL', 'mysql://localhost/futureetp'],
    ['API_TOKEN', 'short'],
    ['SCHEDULER_ENABLED', 'maybe'],
    ['PORT', '-1'],
    ['LOG_LEVEL', 'trace'],
  ])('%s=%s 는 거부한다', (key, value) => {
    expect(() => parseConfig({ ...validEnv, [key]: value })).toThrow(key);
  });
});
