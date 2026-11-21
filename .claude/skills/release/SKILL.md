---
name: release
description: prod 서버 배포, 앱 OTA(EAS Update), Android release APK 배포(Firebase App Distribution)를 순서와 사전 확인에 맞춰 진행한다. 사용자가 /release로 부를 때만 쓴다.
argument-hint: '[server|ota|android] (생략하면 변경 내용으로 판단)'
disable-model-invocation: true
---

# 배포

명령 문법은 `docs/ops.md`, 근거는 D-039·D-048·D-052. 모두 저장소 루트에서 실행한다.

## 0. 공통 사전 확인

1. `git status`가 깨끗해야 한다. 배포본은 push된 커밋 하나다.
2. 배포 커밋을 push하고 `npm run ci:wait`로 CI 통과를 확인한다(D-130). 세 배포 명령은 `scripts/release-guard.sh`로 미커밋 변경·push·CI 성공을 다시 확인하고 아니면 거부한다(D-131). `SKIP_CI_CHECK=1`은 사용자가 요청할 때만 쓴다.
3. 대상을 정한다. 인자가 없으면 마지막 배포 이후 바뀐 경로로 고른다. 서버는 `npm run deploy:status`가 서빙 중 커밋과 그 뒤 서버 경로 변경을 보여 준다(D-132).
   - `apps/server`·`packages/shared`·`infra`·`scripts/calendar` → server
   - `apps/mobile`·`packages/shared` → ota 또는 android (아래 4번으로 판단)
   - `packages/shared`가 바뀌면 server와 앱 둘 다
4. 앱은 OTA로 되는지 먼저 본다. 마지막 APK 빌드 이후 `apps/mobile/package.json`(scripts·의존성), `app.config.ts`, config plugin, 네이티브 모듈이 바뀌었으면 fingerprint(runtime version)가 달라져 설치된 빌드가 OTA를 못 받는다 → android로 새로 빌드한다.
5. 대상과 실행할 명령을 사용자에게 보여 주고 확인을 받은 뒤 진행한다(외부로 나가는 작업).
6. 배포 명령(`deploy`·`update:prod`·`distribute:android`)은 확인 한 번에 한 번만 실행한다. 출력은 `2>&1 | tee <scratchpad>/release-<대상>.log`로 남기고, 결과 확인(커밋 해시·runtime version 등)은 이 파일을 읽어서 한다. 확인용 명령에 배포 명령을 다시 넣지 않는다. 실패해도 다시 실행하기 전에 사용자 확인을 받는다.

## server

1. `npm run deploy`. 설정은 `~/.config/futureetp/ops.env`의 `DEPLOY_HOST`.
2. VM에서 ② 이미지 빌드 → ③ pg_dump → ④ migrate → ⑤ 서버 교체 → ⑥ 커밋 태그·배포 기록이 돌고, Mac에서 외부 health가 그 커밋을 보낼 때까지 기다린다. ④가 실패하면 이전 서버가 그대로 돈다. 실패하면 출력의 단계 번호와 오류를 보고하고 멈춘다(VM에서 임의로 고치지 않는다).
3. 끝나면 남긴 출력의 `health: ... 서빙 중 <커밋>` 줄이 배포한 커밋과 맞는지 확인한다.
4. 배포 뒤 문제가 보이면 `npm run deploy:rollback`을 제안한다(사용자 확인 후). 마이그레이션이 바뀐 배포면 VM이 거부하므로 그때는 멈추고 보고한다.

## ota

1. `npm run update:prod`. `apps/mobile`·`packages/shared`를 마지막으로 바꾼 커밋의 제목 줄이 업데이트 메시지가 된다(`git log -1 --format=%s -- apps/mobile packages/shared`로 미리 본다).
2. 출력의 runtime version과 채널(`production`)을 보고한다.
3. 기기에서 앱을 두 번 껐다 켜야 적용된다는 점을 안내한다(첫 실행에서 내려받고 다음 실행에 적용).

## android

1. `npm run build:android:release -w apps/mobile` (오래 걸리므로 백그라운드 실행).
2. `npm run distribute:android -- [릴리스 노트]`. 노트를 생략하면 `apps/mobile`·`packages/shared`를 마지막으로 바꾼 커밋을 쓰고, APK가 그 커밋보다 오래됐으면 거부한다.
3. 기기의 App Tester 앱에서 설치하도록 안내한다.

## 마무리

- 배포 결과(대상, 커밋, runtime version 등)를 짧게 보고한다.
- 단계 진행이 바뀌었으면 `TODO.md` 갱신을 제안한다.
