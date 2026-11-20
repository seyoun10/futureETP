import { afterAll, describe, expect, it, vi } from 'vitest';
import { db } from './client.ts';

afterAll(() => db.$client.end());

describe('db pool', () => {
  // 리스너가 없으면 pg 풀이 유휴 연결의 error를 처리되지 않은 이벤트로 던져 프로세스가 끝났다(재시작 때 진행 중 배치를 잃음)
  it('유휴 연결이 끊겨도 로그만 남기고 계속 쓴다', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pool = db.$client;
    const idle = await pool.connect();
    const killer = await pool.connect();
    try {
      const { rows } = await idle.query<{ pid: number }>('select pg_backend_pid() as pid');
      idle.release();
      await killer.query('select pg_terminate_backend($1)', [rows[0]!.pid]);
    } finally {
      killer.release();
    }
    await vi.waitFor(() =>
      expect(logged).toHaveBeenCalledWith(
        'pg idle client error',
        expect.objectContaining({ code: '57P01' }),
      ),
    );
    const { rows } = await pool.query<{ one: number }>('select 1 as one');
    expect(rows).toEqual([{ one: 1 }]);
    logged.mockRestore();
  });
});
