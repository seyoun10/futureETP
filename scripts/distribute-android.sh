#!/usr/bin/env bash
# release APK를 Firebase App Distribution 테스터 그룹 owner에 올린다(D-039 보충). 저장소 루트에서:
#   npm run distribute:android -- [릴리스 노트]
# 노트를 주지 않으면 앱 번들에 들어가는 폴더(apps/mobile·packages/shared)를 마지막으로 바꾼 커밋을 쓴다.
# docs 커밋처럼 APK와 상관없는 커밋이 뒤에 붙어도 노트가 실제 빌드 내용을 가리킨다.
# 빌드는 먼저: npm run build:android:release -w apps/mobile
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

APK=apps/mobile/android/app/build/outputs/apk/release/app-release.apk
PROJECT=futureetp-7584b
APP_ID=1:1003667959558:android:ffe4dc355aa8d04551b887
GROUP=owner
APP_PATHS=(apps/mobile packages/shared)

fail() {
  echo "distribute-android: $*" >&2
  exit 1
}

[[ -f "$APK" ]] || fail "APK가 없습니다: $APK (npm run build:android:release -w apps/mobile)"

# 마지막 앱 커밋보다 오래된 APK면 그 커밋이 빠진 빌드다
last_app_commit_time=$(git log -1 --format=%ct -- "${APP_PATHS[@]}")
apk_time=$(stat -f %m "$APK")
((apk_time >= last_app_commit_time)) ||
  fail "APK가 마지막 앱 커밋($(git log -1 --format=%h -- "${APP_PATHS[@]}"))보다 오래됐습니다. 다시 빌드하세요"

notes="${1:-$(git log -1 --format='%h %s' -- "${APP_PATHS[@]}")}"
echo "distribute-android: 릴리스 노트: $notes"

npx firebase-tools@latest appdistribution:distribute "$APK" \
  --project "$PROJECT" --app "$APP_ID" --groups "$GROUP" --release-notes "$notes"
