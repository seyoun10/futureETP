# 리서치: 커브 거래량 기준, 일일 정산 시각, 보관 범위

> Step 2 리서치 남은 항목 (2026-10-22). 거래량은 Yahoo 비공식 chart API 실측, 정산 시각은 CME 문서 기준이다.

## 핵심 결론
- 커브 월물: 최근 20거래일 평균 거래량이 **100계약 이상**인 월물을 가까운 쪽부터 이어 붙이고, 처음 미달하는 월물에서 멈춘다. 상한은 **24개**다(D-018).
- 일일 정산 배치: **18:30 CT**(America/Chicago). CME 최종 정산가(final pre-clearing)가 18:00 CT에 나온다. 소스 반영 시각은 개발 단계에서 실측한다(D-019).
- C-b 기준일 하한: `daily_bar` 적재 시작일(Databento GLBX.MDP3, 2010-06-06~). 일봉은 영구 보관한다(D-020).

## 커브 거래량 실측 (Yahoo `v8/finance/chart?range=1mo&interval=1d`, 2026-10-22)
월물별 최근 약 22거래일 평균 거래량(계약). 금속은 활성 월물만 조회했다. 괄호는 거래량 0인 날 수.

| 원자재 | 1,000 이상 (연속) | 100 이상 (연속) | 100 미만으로 처음 떨어지는 월물 | 비고 |
|---|---|---|---|---|
| CL | CLX26~CLH28 (18개) | CLX26~CLF29 (27개) | CLG29 92 | 12월물은 멀리까지 거래가 많다(CLZ29 3,444, CLZ30 1,031) |
| NG | NGX26~NGJ28 (18개) | NGX26~NGZ28 (26개) | NGF29 93 | 2029년 이후 월물은 대부분 한 자리 수, 0인 날이 많다 |
| GC | GCV26~GCM27 (5개) | GCV26~GCM28 (11개) | GCQ28 26 (0인 날 8) | GCZ26 149,770에 쏠림 |
| SI | SIZ26~SIK27 (3개) | SIZ26~SIU27 (5개) | SIZ27 67 | SIH28 16 (0인 날 4) |

- 100계약 아래부터 거래량 0인 날이 나타난다(GCQ28 26 → 8일, SIH28 16 → 4일, NGJ29 20 → 1일). 거래가 없는 날이 섞이면 장중 현재가가 마지막 체결가에 머물러 변화율이 왜곡된다.
- 1,000계약 기준이면 은이 3개뿐이라 커브 모양을 보기 어렵다. 100계약이면 은 5개, 금 11개로 1년 안팎을 덮는다.
- 거래량이 많은 먼 월물(CL 12월물)만 띄엄띄엄 넣으면 x축 간격이 들쭉날쭉해진다. 그래서 처음 미달하는 월물에서 멈춘다.
- 100계약 연속 기준이면 CL 27개, NG 26개로 화면 폭(세로 약 360pt)에 비해 많다. 상한 24개로 자른다(약 2년).

## 커브 월물 규칙 (D-018)
- 각 커브(기준일, D)는 **그 날짜 기준** 직전 20거래일 평균 거래량(`daily_bar.volume`)으로 월물을 고른다. D가 장중이면 오늘을 빼고 전일까지로 계산한다.
- 가장 가까운 대상 월물부터 만기순으로 넣고, 평균이 100계약 미만인 월물이 처음 나오면 멈춘다. 최대 24개. M1보다 이른 월물은 기준을 적용하지 않는다(D-026).
- 대표월물(M1)과 그다음 월물(M2)은 기준과 관계없이 넣는다. 롤 수익률 계산에 필요하기 때문이다.
- 상장 후 20거래일이 안 된 월물은 있는 날만으로 평균한다. 첫 일봉 이후 봉이 없는 날은 거래량 0으로 센다(D-068 리뷰 수정).
- 변화율은 두 커브에 모두 있는 월물에만 붙인다.
- 기준값(100계약, 20거래일, 24개)은 서버 상수로 둔다. 설정 테이블은 만들지 않는다(개인용, 바꿀 일이 드묾).

## 일일 정산 시각 (D-019)
| 시각 (CT) | 내용 |
|---|---|
| 12:24~12:30 | 금속 정산 구간(은 12:24~12:25, 금 12:29~12:30) |
| 13:28~13:30 | 에너지 정산 구간 |
| 정산 구간 직후~ | 잠정(preliminary) 정산가 게시. 최종 전까지 바뀔 수 있다(금리 상품 예시는 14:15~16:30에 5회) |
| 18:00 | 최종(final pre-clearing) 정산가 게시 |
| 다음 날 | NYMEX·COMEX는 결제 후(post-clearing) 한 번 더 내보내 미결제약정을 갱신한다 |

- 배치는 **18:30 CT**에 돈다. 최종 정산가 뒤 30분 여유를 둔다. 한국 시간으로 서머타임 중 08:30, 겨울 09:30이다.
- 소스(Massive) 반영이 늦으면 같은 거래일 데이터가 없으므로, 기존 실패 규칙대로 1회 다시 시도한다. 재시도 시각과 Massive 반영 시각은 가입 후 실측해 정한다.
- 거래량·미결제약정은 다음 날 값이 바뀔 수 있다. 다음 날 배치의 "전일 정산가 정정 확인"에서 거래량도 함께 다시 받는다.
- Massive 세션 집계(session aggregates)에는 거래소 공식 정산가(settlement) 필드가 있다(flat file 문서 기준). REST·Basic 요금제에서 같은 필드를 주는지는 가입 후 확인한다.
  - 2026-10-28 확인: REST 세션 집계 `settlement_price`가 Basic에서도 오고 Databento와 일치한다. 거래 없는 날은 봉이 없다(`market-data.md` Massive Basic 실측).
- 조기 마감일에는 정산 구간이 앞당겨지지만 최종 정산가 게시 시각은 실측 전까지 같은 18:30 CT로 둔다.

## 과거 데이터 보관 범위 (D-020)
- `daily_bar`는 Databento 1회 적재 시작일(GLBX.MDP3 2010-06-06)부터 영구 보관한다(`data-model.md` 보관 기간).
- C-b 기준일 하한은 해당 원자재의 가장 이른 `daily_bar.trade_date`다. 지난 기준일 커브도 위 커브 월물 규칙을 그 날짜 기준으로 적용한다.
- 일봉 용량은 작다. 원자재 4종 × 동시 상장 월물 약 100개 × 16년이라도 수십만 행 수준이다.
- Massive Basic·Yahoo는 이력이 2년 안팎이라 적재에 쓰지 않는다. 적재 뒤에는 증분만 받는다.

## 출처
- 거래량: Yahoo `query2.finance.yahoo.com/v8/finance/chart/{CLX26.NYM 등}?range=1mo&interval=1d` (2026-10-22 직접 호출, 비공식)
- [CME: About Settlements](https://cmegroup.com/trading/about-settlements.html) (최종 정산가 18:00 CT, NYMEX·COMEX post-clearing)
- [CME DataMine: STL INT Settlements](https://cmegroupclientsite.atlassian.net/wiki/spaces/EPICSANDBOX/pages/457092276/STL+INT+Settlements) (잠정·최종 파일 게시 시각)
- [CME Daily Settlement Time Details](https://cmegroupclientsite.atlassian.net/wiki/spaces/EPICSANDBOX/pages/457085528/Daily+Settlement+Time+Details)
- [Massive: NYMEX session aggregates](https://massive.com/docs/flat-files/futures/session-aggregates/nymex.md) (settlement 필드)
- [Databento GLBX.MDP3](https://databento.com/docs/knowledge-base/datasets/glbx-mdp3)
