import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDatabentoClient, outrightRawSymbols, twoDigitRawSymbols } from './databento.ts';

describe('outrightRawSymbols', () => {
  it('월 코드 12개 × 연도 1자리 10개의 단일 월물이다', () => {
    const symbols = outrightRawSymbols('CL');
    expect(symbols).toHaveLength(120);
    expect(symbols).toContain('CLF0');
    expect(symbols).toContain('CLZ9');
    expect(symbols.every((s) => /^CL[FGHJKMNQUVXZ]\d$/.test(s))).toBe(true);
  });
});

describe('twoDigitRawSymbols', () => {
  it('월 코드 12개 × 연도 2자리 10~39의 단일 월물이다', () => {
    const symbols = twoDigitRawSymbols('NG');
    expect(symbols).toHaveLength(360);
    expect(symbols).toContain('NGF10');
    expect(symbols).toContain('NGZ39');
    expect(symbols.every((s) => /^NG[FGHJKMNQUVXZ][1-3]\d$/.test(s))).toBe(true);
  });
});

describe('createDatabentoClient', () => {
  const request = {
    schema: 'statistics' as const,
    symbols: ['CLZ6', 'CLF7'],
    start: '2010-06-06',
    end: '2026-10-27T00:00:00Z',
  };

  it('견적은 Basic 인증(키:빈 비밀번호) POST form으로 보낸다', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response('6.79')));
    const client = createDatabentoClient('db-key', fetchFn);
    expect(await client.cost(request)).toBe(6.79);

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('https://hist.databento.com/v0/metadata.get_cost');
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from('db-key:').toString('base64')}`,
    );
    const form = init?.body as URLSearchParams;
    expect(Object.fromEntries(form)).toEqual({
      dataset: 'GLBX.MDP3',
      schema: 'statistics',
      symbols: 'CLZ6,CLF7',
      stype_in: 'raw_symbol',
      start: '2010-06-06',
      end: '2026-10-27T00:00:00Z',
    });
  });

  it('HTTP 오류는 상태와 본문을 담아 던진다', async () => {
    const fetchFn = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('bad symbols', { status: 422 })),
    );
    const client = createDatabentoClient('db-key', fetchFn);
    await expect(client.cost(request)).rejects.toThrow(/HTTP 422 bad symbols/);
  });

  it('스키마별 범위 끝을 읽는다', async () => {
    const body = { schema: { statistics: { end: '2026-10-27T00:13:51Z' } } };
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(Response.json(body)));
    const client = createDatabentoClient('db-key', fetchFn);
    expect(await client.datasetRangeEnd('statistics')).toBe('2026-10-27T00:13:51Z');
    await expect(client.datasetRangeEnd('definition')).rejects.toThrow(/no range/);
  });

  describe('downloadCsv', () => {
    let dir: string;
    beforeEach(async () => {
      dir = await mkdtemp(join(tmpdir(), 'databento-test-'));
    });
    afterEach(() => rm(dir, { recursive: true, force: true }));

    it('CSV·zstd·사람이 읽는 값으로 받아 .part를 거쳐 path에 쓴다', async () => {
      const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response('csv-bytes')));
      const path = join(dir, 'CL.csv.zst');
      await createDatabentoClient('db-key', fetchFn).downloadCsv(request, path);

      expect(await readFile(path, 'utf8')).toBe('csv-bytes');
      expect(existsSync(`${path}.part`)).toBe(false);
      const [url, init] = fetchFn.mock.calls[0]!;
      expect(url).toBe('https://hist.databento.com/v0/timeseries.get_range');
      expect(Object.fromEntries(init?.body as URLSearchParams)).toMatchObject({
        schema: 'statistics',
        encoding: 'csv',
        compression: 'zstd',
        pretty_px: 'true',
        pretty_ts: 'true',
        map_symbols: 'true',
      });
    });

    it('받다가 실패하면 path도 .part도 남기지 않는다', async () => {
      const fetchFn = vi.fn<typeof fetch>(() =>
        Promise.resolve(new Response('quota', { status: 402 })),
      );
      const path = join(dir, 'CL.csv.zst');
      await expect(
        createDatabentoClient('db-key', fetchFn).downloadCsv(request, path),
      ).rejects.toThrow(/HTTP 402/);

      expect(existsSync(path)).toBe(false);
      expect(existsSync(`${path}.part`)).toBe(false);
    });

    it('.part가 이미 있으면 요청(과금) 전에 실패하고 그 파일을 지우지 않는다', async () => {
      const fetchFn = vi.fn<typeof fetch>();
      const path = join(dir, 'CL.csv.zst');
      await writeFile(`${path}.part`, 'other process');

      await expect(
        createDatabentoClient('db-key', fetchFn).downloadCsv(request, path),
      ).rejects.toThrow(/EEXIST/);

      expect(fetchFn).not.toHaveBeenCalled();
      expect(await readFile(`${path}.part`, 'utf8')).toBe('other process');
    });
  });
});
