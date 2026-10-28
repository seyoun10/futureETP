import { describe, expect, it } from 'vitest';
import { JOB_NAMES, LOCALES } from './domain.ts';
import { jobFailedPush, rareLevelPush, type RareLevelAlert } from './push.ts';

// 2026-10-28 00:00 UTC = 09:00 KST
const alert: RareLevelAlert = {
  commodity: 'CL',
  basis: 'US',
  direction: 'UP',
  level: 5,
  disparity: 19.234,
  maPeriod: 100,
  detectedAt: new Date('2026-10-28T00:00:00Z'),
  deferred: false,
};

describe('rareLevelPush', () => {
  it('와이어프레임 X 형식으로 만든다(사용자 시간대 HH:mm)', () => {
    expect(rareLevelPush('ko', 'Asia/Seoul', alert)).toEqual({
      title: '원유(미국형) 이격도 상위 5% 도달',
      body: '+19.2%(고가 기준) · 100일선 · 09:00',
    });
    expect(rareLevelPush('en', 'America/New_York', alert)).toEqual({
      title: 'Crude Oil (US-style) disparity hit top 5%',
      body: '+19.2% (high) · 100-day MA · 20:00',
    });
  });

  it('아래 방향은 하위·저가 기준, 레벨은 소수 첫째 자리까지', () => {
    const down = {
      ...alert,
      commodity: 'NG',
      basis: 'FRONT',
      direction: 'DOWN',
      level: 2.5,
      disparity: -12.26,
      maPeriod: 20,
    } as const;
    expect(rareLevelPush('ko', 'Asia/Seoul', down)).toEqual({
      title: '천연가스(대표월물) 이격도 하위 2.5% 도달',
      body: '-12.3%(저가 기준) · 20일선 · 09:00',
    });
    expect(rareLevelPush('en', 'Asia/Seoul', down).title).toBe(
      'Natural Gas (Front month) disparity hit bottom 2.5%',
    );
  });

  it('지연 발송이면 시각 자리에 감지 시각과 지연 발송을 붙인다', () => {
    const deferred = { ...alert, detectedAt: new Date('2026-10-27T18:00:00Z'), deferred: true };
    expect(rareLevelPush('ko', 'Asia/Seoul', deferred).body).toBe(
      '+19.2%(고가 기준) · 100일선 · 03:00 감지 · 지연 발송',
    );
    expect(rareLevelPush('en', 'Asia/Seoul', deferred).body).toBe(
      '+19.2% (high) · 100-day MA · detected 03:00 · delayed',
    );
  });

  it('반올림해 0이면 부호를 붙이지 않는다', () => {
    for (const disparity of [0.04, -0.04]) {
      expect(rareLevelPush('ko', 'UTC', { ...alert, disparity }).body).toBe(
        '0.0%(고가 기준) · 100일선 · 00:00',
      );
    }
  });
});

describe('jobFailedPush', () => {
  it('한 줄 운영 알림', () => {
    expect(jobFailedPush('ko', 'DAILY_SETTLE')).toEqual({
      title: '서버 작업 실패: 일일 정산',
      body: null,
    });
    expect(jobFailedPush('en', 'DAILY_SETTLE').title).toBe('Server job failed: Daily settlement');
  });

  it('모든 언어·작업에 문구가 있다', () => {
    for (const locale of LOCALES) {
      for (const job of JOB_NAMES) {
        expect(jobFailedPush(locale, job).title).not.toMatch(/undefined/);
      }
    }
  });
});
