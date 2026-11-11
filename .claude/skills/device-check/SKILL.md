---
name: device-check
description: 실제 iPhone 화면을 iPhone 미러링 앱으로 캡처·조작해 UI 변경을 확인하거나, dev 변형을 운영 번들로 띄워 차트 성능([perf] 로그)을 측정할 때 쓴다. 시각 조정 fix처럼 테스트 대신 기기 확인이 필요한 경우에도 쓴다.
argument-hint: '[screen|perf] [확인할 화면·동작]'
---

# 기기 확인

명령 문법은 `docs/ops.md`의 "기기 확인". 모두 저장소 루트에서 실행한다.

## 사전 조건

- Mac에서 iPhone 미러링 앱이 실행 중이어야 한다. 없으면 `mirror: iPhone Mirroring 앱을 먼저 실행하세요`로 끝난다 → 사용자에게 실행을 부탁한다.
- 터미널에 손쉬운 사용·화면 기록 권한이 필요하다. 권한 오류면 사용자에게 시스템 설정에서 켜 달라고 한다.
- 기기에는 dev 변형(`.dev` 번들 ID)이 설치돼 있고, 확인할 JS 변경은 Metro(`npm run start -w apps/mobile`)로 반영돼 있어야 한다.

## screen: 화면 확인

1. `npm run mirror -- shot <scratchpad>/before.png`로 현재 화면을 찍고 이미지를 읽는다. 이미지 픽셀 좌표가 그대로 tap·drag 좌표다.
2. 대상 화면까지 `tap X Y`로 이동한다. 길게 누르기(십자선)는 `tap X Y 600`, 차트 이동은 `drag X1 Y1 X2 Y2`.
3. 동작마다 다시 `shot`을 찍어 결과를 확인한다. 한 번에 여러 동작을 몰아서 하지 않는다(좌표가 어긋나면 엉뚱한 곳을 누른다).
4. 미러링으로 못 보는 것: 핀치, 당겨서 새로고침, 키패드 위 UI. 이런 확인은 사용자에게 기기에서 직접 봐 달라고 한다.
5. 스크린샷 파일은 scratchpad에 둔다. README용 이미지는 `shot --clean <파일>`(폭 480px, 좌표로 쓰지 않음).

## perf: 성능 측정

1. `npm run perf:collect -- <scratchpad>/perf.log`를 백그라운드로 켠다(포트 8099).
2. 앱을 운영 번들로 다시 띄운다: `xcrun devicectl device process launch --device <기기> --terminate-existing <dev 번들 ID> -- -RCT_enableDev NO -RCT_enableMinification YES`. 기기 이름은 `xcrun devicectl list devices`, 번들 ID는 `apps/mobile/app.config.ts`의 dev 변형 값.
3. 측정할 동작(차트 진입, 과거 데이터 로딩, 제스처)을 screen 절차로 수행하거나 사용자에게 부탁한다.
4. `[perf]` 줄(`src/lib/perfLog.ts`)을 모아 동작별 수치를 요약하고, 비교 대상이 있으면 전후를 표로 보여 준다.
5. 끝나면 수집기를 끈다.

## 결과 보고

- 무엇을 확인했고 기대와 맞았는지, 근거 스크린샷 경로(전체 절대 경로)를 함께 보고한다.
- 시각 조정 `fix:` 커밋은 회귀 테스트 대신 이 확인으로 갈음한다(CLAUDE.md Coding Conventions).
