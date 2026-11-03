#!/usr/bin/env bash
# iPhone 미러링 앱으로 실기기 화면을 캡처하고 조작한다(Mac에서 기기 확인용). npm run mirror -- <명령>
#   shot [파일]                          창을 캡처해 point 크기 PNG로 저장(기본 mirror.png)
#   tap X Y [누름ms]                     창 기준 point 좌표 탭. 누름ms를 주면 길게 누르기(십자선 등)
#   drag X1 Y1 X2 Y2 [단계] [누름ms]     끌기(차트 이동). 누름ms를 주면 길게 누른 뒤 끌기
#   type 글자 / key delete|return|esc    Mac 키보드 입력(미러링은 iPhone 키패드를 띄우지 않는다)
# 캡처 이미지의 픽셀 좌표 = tap·drag 좌표다. 핀치·당겨서 새로고침·키패드 위 UI는 미러링으로 확인할 수 없다.
# 터미널 앱에 손쉬운 사용·화면 기록 권한이 필요하다.
set -euo pipefail

APP="iPhone Mirroring"
SRC="$(cd "$(dirname "$0")" && pwd)/mirror/input.swift"
BIN="${XDG_CACHE_HOME:-$HOME/.cache}/futureetp/mirror-input"

fail() {
  echo "mirror: $*" >&2
  exit 1
}

pgrep -qf "$APP.app" || fail "$APP 앱을 먼저 실행하세요"

# 창 위치·크기(point). "x, y, w, h"
read -r WX WY WW WH < <(osascript -e "tell application \"System Events\" to tell process \"$APP\" to get {position, size} of window 1" | tr -d ',')

activate() { osascript -e "tell application \"$APP\" to activate"; }

input() {
  if [[ ! -x "$BIN" || "$SRC" -nt "$BIN" ]]; then
    mkdir -p "$(dirname "$BIN")"
    swiftc -O "$SRC" -o "$BIN"
  fi
  "$BIN" "$@"
}

cmd="${1:-}"
shift || true
case "$cmd" in
  shot)
    out="${1:-mirror.png}"
    # 영역 캡처라 다른 창이 위에 있으면 그 창이 찍힌다
    activate
    sleep 0.3
    screencapture -x -R"$WX,$WY,$WW,$WH" "$out"
    sips -z "$WH" "$WW" "$out" >/dev/null
    echo "$out"
    ;;
  tap)
    (($# >= 2)) || fail "tap X Y [누름ms]"
    activate
    input tap "$((WX + $1))" "$((WY + $2))" ${3:+"$3"}
    ;;
  drag)
    (($# >= 4)) || fail "drag X1 Y1 X2 Y2 [단계] [누름ms]"
    activate
    input drag "$((WX + $1))" "$((WY + $2))" "$((WX + $3))" "$((WY + $4))" "${5:-20}" ${6:+"$6"}
    ;;
  type)
    (($# >= 1)) || fail "type 글자"
    activate
    osascript -e "tell application \"System Events\" to keystroke \"$1\""
    ;;
  key)
    case "${1:-}" in
      delete) code=51 ;;
      return) code=36 ;;
      esc) code=53 ;;
      *) fail "key delete|return|esc" ;;
    esac
    activate
    osascript -e "tell application \"System Events\" to key code $code"
    ;;
  *)
    sed -n '2,8p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
