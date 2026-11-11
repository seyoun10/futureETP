# 운영·기기 확인 명령

가끔 쓰는 명령 모음. 일상 개발 명령은 `CLAUDE.md`의 Commands. 모두 저장소 루트에서 실행한다.

## 데이터 적재

- Databento 1회 적재(D-088): `npm run databento:download -w apps/server -- [--yes] [--out <폴더>]`(기본은 견적만, `--yes`면 과금 다운로드) → `npm run databento:import -w apps/server -- [--dry-run] [--data <폴더>]`

## 앱 빌드·배포

- 앱 OTA(EAS Update, 마지막 커밋 제목 줄로 발행): `npm run update:prod`. `apps/mobile/package.json`의 `scripts`·의존성을 바꾸면 fingerprint(runtime version)가 바뀌어 설치된 빌드가 업데이트를 못 받으므로 새로 빌드해야 한다
- Android 기기 설치(Firebase App Distribution, D-039 보충): `npm run build:android:release -w apps/mobile` → `npm run distribute:android -- [릴리스 노트]`
- gradle을 직접 부를 때는 `APP_VARIANT=development ./gradlew ...`로 실행한다. 빠지면 패키지 ID는 `.dev`인데 내장 `app.config`가 prod라 접근 키 화면에 머문다. 확인은 `app/build/intermediates/assets/debug/mergeDebugAssets/app.config`의 `extra.variant`

## 서버 운영 (Mac, 설정은 `~/.config/futureetp/ops.env`)

- prod 배포: `npm run deploy`(D-048)
- VM 백업 내려받기: `npm run backup:pull`
- dev DB에 덤프 복원: `npm run dev:restore -- [덤프 파일] [--yes]`(D-045)
- 첫 배포 뒤 빈 prod DB에 dev DB 넣기: `npm run prod:seed -- [--yes]`(D-100)
- 접근 키(D-080): 새 키·QR `npm run access-key`, 기존 키 QR `npm run access-key -- --show < 키 파일`

## 기기 확인

- 성능 측정(dev 변형 iOS 기기): `npm run perf:collect -- [파일]`(포트 8099) 켜고 앱을 운영 번들로 실행 `xcrun devicectl device process launch --device <기기> --terminate-existing <dev 번들 ID> -- -RCT_enableDev NO -RCT_enableMinification YES`. 차트 진입·과거 데이터 로딩·제스처 프레임이 `[perf]` 줄로 들어온다(`src/lib/perfLog.ts`)
- 기기 화면 확인(iPhone 미러링 앱): `npm run mirror -- shot <파일>`(창을 point 크기 PNG로, 이미지 픽셀 = 조작 좌표) · `shot --clean <파일>`(README 스크린샷: 휴대폰만 잘라 폭 480px) · `tap X Y [누름ms]` · `drag X1 Y1 X2 Y2 [단계] [누름ms]` · `type 글자` · `key delete|return|esc`. 핀치·당겨서 새로고침·키패드 위 UI는 미러링으로 못 본다
