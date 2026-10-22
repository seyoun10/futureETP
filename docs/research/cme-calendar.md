# 리서치: CME 달력 (거래일·거래 시간·최종 거래일·활성 월물)

> Step 2 리서치 2/5 (2026-10-22). CME 공식 페이지(계약 명세, 룰북)는 자동 수집이 막혀 있어 검색 요약과 서드파티 자료로 확인했다. 구현 전에 CME 계약 명세 페이지에서 한 번 더 확인한다.

## 핵심 결론
- 에너지(CL·NG)와 금속(GC·SI)은 **같은 Globex 휴장·조기 마감 일정**을 따른다. `trading_day`는 `trade_date` 하나를 키로 유지한다(거래소별 키 불필요).
- 미국 공휴일(MLK, Presidents' Day 등)에도 Globex는 열리지만 **13:30 CT에 멈추고, 그 세션은 다음 거래일에 합쳐진다.** 그날은 정산가가 없으므로 CME 거래일이 아니다.
- 최종 거래일은 규칙으로 계산하지 않고 **시세 소스의 계약 정의(만기일)를 저장**한다. 규칙 계산은 검증용으로만 쓴다.
- 금속 활성 월물(금 2·4·6·8·10·12월, 은 3·5·7·9·12월)은 CME가 정한 "상장 규칙"이 아니라 시장 관행이다. 지금처럼 `active_month_rule` 데이터로 관리한다.

## 거래 시간과 휴장
| 구분 | 내용 |
|---|---|
| 정규 세션 | 일~금 17:00 ~ 익일 16:00 CT, 매일 16:00~17:00 CT 휴식 |
| 전일 휴장 | 새해 첫날, Good Friday, 크리스마스 |
| 공휴일 중간 정지 | MLK, Presidents', Memorial, Juneteenth, Independence, Thanksgiving: 13:30 CT 정지, 17:00 CT 재개(다음 거래일 세션). 2022년 이전에는 12:00 CT |
| 조기 마감 | Labor Day 12:00 CT, 추수감사절 다음 날 12:45 CT |

- 위 표는 `pandas_market_calendars` 5.2.4의 `CMEGlobex_EnergyAndMetals` 달력 정의를 읽고 정리한 것이다. 에너지와 금속을 같은 달력으로 다룬다.
- 2026 MLK 일정(DTN): 에너지·금속은 13:30 CT 정지, 17:00 CT에 다음 거래일(화) 세션으로 재개한다.
- 크리스마스이브 같은 날의 TAS(Trading at Settlement) 조기 마감 시각은 상품별로 다르지만, 이 서비스는 TAS를 쓰지 않는다.
- 라이브러리는 규칙을 코드에 내장하고 있어 CME가 일정을 바꾸면 반영이 늦을 수 있다. 연 1회 CME 휴일 공지와 대조해 `trading_day`를 고친다.

### 서비스 규칙에 주는 영향
- CME 거래일 = 정산가가 나오는 날이다. 공휴일 중간 정지일은 거래일이 아니다.
- 공휴일 아침 세션(예: MLK 월요일 00:00~13:30 CT)에 장중 배치가 돌면, 스냅숏은 **다음 거래일**의 잠정값이다.
- 그래서 거래일 하나의 세션이 중간 정지로 두 토막이 날 수 있다(예: 일 17:00 ~ 월 13:30, 월 17:00 ~ 화 16:00). 데이터 모델에 정지 구간을 둔다.

## 최종 거래일 규칙
| 원자재 | 최종 거래일 | 비고 |
|---|---|---|
| CL | 인도월 전월 25일의 3영업일 전. 25일이 영업일이 아니면 25일 직전 영업일의 3영업일 전 | 인도월 전월에 만기 |
| NG | 인도월 전월의 끝에서 3번째 영업일 | 인도월 전월에 만기 |
| GC | 인도월의 끝에서 3번째 영업일 (12:30 CT) | **인도월 안**에서 만기. 거래량은 인도월 전에 다음 활성 월물로 옮겨 간다 |
| SI | 인도월의 끝에서 3번째 영업일 (12:25 CT) | GC와 같음 |

- 금속은 최종 거래일 전에 거래량이 먼저 빠진다. 대표월물 전환은 거래량 규칙으로 일어나고, "최종 거래일 도달" 안전장치는 거의 쓰이지 않는다.
- 2026-10-22 기준 금 OCT26의 최종 거래일은 10/28(수)이다. 그래서 `product.md`의 월물 목록 예시(OCT26부터 5개)가 맞다.

## 상장 월물
| 원자재 | 상장 규칙 (CME 계약 명세 기준) |
|---|---|
| GC | 연속 26개월 + 가장 가까운 72개월 안의 6·12월 |
| SI | 연속 24개월 + 가장 가까운 60개월 안의 7·12월 |
| CL·NG | 장기간 연속 월물 상장 (세부는 계약 명세로 확인) |

- 금속은 비활성 월물도 상장돼 있다. 활성 월물 여부는 데이터(`active_month_rule`)로 판정하는 지금 설계가 맞다.

## 데이터 소스
| 데이터 | 소스 | 갱신 |
|---|---|---|
| 휴장·조기 마감·중간 정지 | `pandas_market_calendars`(서버 Python일 때) 또는 CME 휴일 공지를 보고 직접 입력 | 거래일 달력 배치, 연 1회 + CME 공지 때 |
| 월물 목록·최종 거래일 | 시세 소스의 계약 정의(예: Databento `definition` 스키마의 만기) | 일일 정산 배치(신규 상장 반영) |
| 활성 월물 | 직접 관리(`active_month_rule`) | CME가 바꿀 때만 |

## 출처
- [CME Group Holiday and Trading Hours](https://cmegroup.com/tools-information/holiday-calendar.html)
- [DTN: Martin Luther King Jr. holiday hours 2026](https://iqhelp.dtn.com/martin-luther-kind-jr-holiday-hours-2026/)
- [investingLive: Why Globex still opens on the night before a US market holiday](https://investinglive.com/education/why-globex-still-opens-on-the-night-before-a-us-market-holiday/)
- [pandas_market_calendars](https://docsearch.algolia.com/mcp/docs/repo/rsheftel/pandas_market_calendars) (`calendars/cme_globex_energy_and_metals.py`, 5.2.4)
- [CME Henry Hub Natural Gas contract specs](https://cmegroup.com/trading/energy/natural-gas/natural-gas_contractSpecs_futures.html)
- [CME Gold contract specs](https://cmegroup.com/trading/metals/precious/gold_contractSpecs_futures), [CME Gold fact card](https://www.cmegroup.com/content/dam/cmegroup/market-regulation/files/gold-futures-and-options-fact-card.pdf)
- [CME Silver futures](https://cmegroup.com/trading/metals/precious/silver-futures-and-options.html)
- [WTRG: NYMEX crude oil futures](https://wtrg.com/daily/crudeoilprice.html) (CL 최종 거래일 규칙)
