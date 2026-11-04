#!/usr/bin/env bash
# iPhone 미러링 앱으로 실기기 화면을 캡처하고 조작한다(Mac에서 기기 확인용). npm run mirror -- <명령>
#   shot [파일]                          창을 캡처해 point 크기 PNG로 저장(기본 mirror.png)
#   shot --clean [파일]                  README용: 창만 캡처해 휴대폰 밖(투명·뒤쪽 창)을 잘라 폭 480px로
#   tap X Y [누름ms]                     창 기준 point 좌표 탭. 누름ms를 주면 길게 누르기(십자선 등)
#   drag X1 Y1 X2 Y2 [단계] [누름ms]     끌기(차트 이동). 누름ms를 주면 길게 누른 뒤 끌기
#   type 글자 / key delete|return|esc    Mac 키보드 입력(미러링은 iPhone 키패드를 띄우지 않는다)
# shot 이미지의 픽셀 좌표 = tap·drag 좌표다(--clean 이미지는 잘라 줄였으므로 아니다). 핀치·당겨서 새로고침·키패드 위 UI는 미러링으로 확인할 수 없다.
# 터미널 앱에 손쉬운 사용·화면 기록 권한이 필요하다.
set -euo pipefail

APP="iPhone Mirroring"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)/mirror"
BIN_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/futureetp"
README_SHOT_WIDTH=480

fail() {
  echo "mirror: $*" >&2
  exit 1
}

PID="$(pgrep -f "$APP.app/Contents/MacOS" | head -1)" || fail "$APP 앱을 먼저 실행하세요"

# 창 위치·크기(point). "x, y, w, h"
read -r WX WY WW WH < <(osascript -e "tell application \"System Events\" to tell process \"$APP\" to get {position, size} of window 1" | tr -d ',')

activate() { osascript -e "tell application \"$APP\" to activate"; }

# scripts/mirror/<이름>.swift를 바뀌었을 때만 컴파일해 실행한다
swift_tool() {
  local name="$1" src bin
  shift
  src="$SRC_DIR/$name.swift"
  bin="$BIN_DIR/mirror-$name"
  if [[ ! -x "$bin" || "$src" -nt "$bin" ]]; then
    mkdir -p "$BIN_DIR"
    swiftc -O "$src" -o "$bin"
  fi
  "$bin" "$@"
}

input() { swift_tool input "$@"; }

cmd="${1:-}"
shift || true
case "$cmd" in
  shot)
    if [[ "${1:-}" == --clean ]]; then
      out="${2:-mirror.png}"
      tmp="$(mktemp -d)"
      raw="$tmp/raw.png"
      activate
      sleep 0.3
      # 창 단위 캡처(-o 그림자 없음)라 둥근 모서리 밖은 투명하다. 그 밖을 잘라 낸다
      screencapture -x -o -l "$(swift_tool capture id "$PID")" "$raw"
      swift_tool capture crop "$raw" "$out" "$README_SHOT_WIDTH"
      rm -rf "$tmp"
      echo "$out"
      exit 0
    fi
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
    sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'
    exit 2
    ;;
esac
