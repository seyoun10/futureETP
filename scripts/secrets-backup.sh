#!/usr/bin/env bash
# 저장소 밖 비밀 파일을 암호화 디스크 이미지(AES-256 .dmg) 하나로 묶어 Mac 밖에 보관한다(D-135).
# 저장소 루트에서: npm run secrets:backup -- <보관 폴더>
#   보관 폴더: 외장 디스크나 iCloud Drive 등 Mac 밖과 동기화되는 곳. 이미지 이름은 futureetp-secrets-YYYYMMDD.dmg
#   암호: 실행 중 두 번 묻는다(12자 이상). 표준 입력이 터미널이 아니면 한 줄을 읽는다. 암호는 비밀번호 관리자에 따로 둔다
#   SECRETS_BACKUP_SOURCES  묶을 경로(공백 구분, 기본은 아래 SOURCES). 시험용
# 만든 뒤 이미지를 읽기 전용으로 열어 모든 파일의 SHA-256을 원본과 비교한다.
set -euo pipefail

fail() {
  echo "secrets-backup: $*" >&2
  exit 1
}

DEST="${1:-}"
[[ -n "$DEST" ]] || fail "보관 폴더를 지정하세요(예: npm run secrets:backup -- \"/Volumes/USB\")"
[[ -d "$DEST" ]] || fail "보관 폴더가 없습니다: $DEST"
DEST="$(cd "$DEST" && pwd)"
case "$DEST" in
  "$PWD" | "$PWD"/*) fail "저장소 안에는 보관하지 않습니다: $DEST" ;;
esac

# Android release 서명 키(잃으면 같은 앱으로 업데이트할 수 없다, D-039)와 운영 비밀·VM ssh 키
read -r -a SOURCES <<<"${SECRETS_BACKUP_SOURCES:-$HOME/.config/futureetp $HOME/.ssh/futureetp_oci $HOME/.ssh/futureetp_oci.pub}"
for src in "${SOURCES[@]}"; do
  [[ -e "$src" ]] || fail "원본이 없습니다: $src"
done

IMAGE="$DEST/futureetp-secrets-$(date +%Y%m%d).dmg"
[[ ! -e "$IMAGE" ]] || fail "이미 있습니다(덮어쓰지 않음): $IMAGE"

# 서명 키가 들어 있으면 비밀번호 파일로 열리는지와 인증서 지문을 먼저 확인한다(비밀번호는 출력하지 않음)
KEY_PROPS="$HOME/.config/futureetp/android-release.properties"
if [[ " ${SOURCES[*]} " == *" $HOME/.config/futureetp "* && -f "$KEY_PROPS" ]]; then
  fingerprint="$(
    prop() { sed -n "s/^$1=//p" "$KEY_PROPS"; }
    STOREPASS="$(prop storePassword)" keytool -list -v -keystore "$(prop storeFile)" -alias "$(prop keyAlias)" \
      -storepass:env STOREPASS 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p'
  )" || true
  [[ -n "$fingerprint" ]] || fail "서명 키를 비밀번호 파일로 열지 못했습니다: $KEY_PROPS"
  echo "secrets-backup: 서명 키 인증서 SHA-256 ${fingerprint:0:11}…${fingerprint: -8}"
fi

if [[ -t 0 ]]; then
  read -r -s -p "암호(12자 이상): " PASS
  echo
  read -r -s -p "암호 확인: " PASS2
  echo
  [[ "$PASS" == "$PASS2" ]] || fail "두 암호가 다릅니다"
else
  read -r PASS || true
fi
[[ ${#PASS} -ge 12 ]] || fail "암호가 12자보다 짧습니다"

umask 077
WORK="$(mktemp -d)"
MOUNT=""
cleanup() {
  [[ -z "$MOUNT" ]] || hdiutil detach -quiet "$MOUNT" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

STAGE="$WORK/futureetp-secrets"
mkdir -p "$STAGE"
for src in "${SOURCES[@]}"; do
  # 홈 기준 상대 경로를 유지한다(복원할 때 그대로 되돌리기 쉽게)
  rel="${src#"$HOME"/}"
  mkdir -p "$STAGE/$(dirname "$rel")"
  cp -pR "$src" "$STAGE/$rel"
done
(cd "$STAGE" && find . -type f ! -name MANIFEST.sha256 -print0 | sort -z | xargs -0 shasum -a 256 >MANIFEST.sha256)
cat >"$STAGE/RESTORE.txt" <<'EOF'
복원: 이미지를 열고 각 경로를 홈 폴더 기준 같은 위치로 복사한다(예: .config/futureetp → ~/.config/futureetp).
권한: chmod 700 ~/.config/futureetp; chmod 600 ~/.config/futureetp/* ~/.ssh/futureetp_oci
확인: 이미지 안에서 shasum -a 256 -c MANIFEST.sha256
서명 키 지문: keytool -list -v -keystore ~/.config/futureetp/android-release.jks (TODO.md의 SHA-256과 비교)
EOF
count="$(wc -l <"$STAGE/MANIFEST.sha256" | tr -d ' ')"

printf '%s' "$PASS" | hdiutil create -quiet -encryption AES-256 -stdinpass -fs APFS \
  -volname futureetp-secrets -srcfolder "$STAGE" -format UDZO "$IMAGE"

# 검증: 이미지를 읽기 전용으로 열어 원본과 같은지 확인
MOUNT="$WORK/mnt"
mkdir -p "$MOUNT"
printf '%s' "$PASS" | hdiutil attach -quiet -stdinpass -readonly -nobrowse -mountpoint "$MOUNT" "$IMAGE"
(cd "$MOUNT" && shasum -a 256 -c --quiet MANIFEST.sha256) || fail "이미지 검증 실패: $IMAGE"
for src in "${SOURCES[@]}"; do
  rel="${src#"$HOME"/}"
  diff -rq "$src" "$MOUNT/$rel" >/dev/null || fail "원본과 다릅니다: $rel"
done
hdiutil detach -quiet "$MOUNT"
MOUNT=""
unset PASS PASS2

echo "secrets-backup: 완료 $IMAGE (파일 ${count}개, $(du -h "$IMAGE" | cut -f1 | tr -d ' '))"
echo "secrets-backup: 암호는 비밀번호 관리자에 저장하세요. 암호를 잃으면 이 이미지는 열 수 없습니다"
