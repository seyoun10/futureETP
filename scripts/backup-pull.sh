#!/usr/bin/env bash
# VM의 최신 BACKUP 덤프를 Mac으로 받는다(D-045, 주 1회 목표). 저장소 루트에서: npm run backup:pull
#   DEPLOY_HOST            ssh 대상(필수)
#   DEPLOY_DIR             VM의 배포 폴더(기본 futureetp, 홈 기준)
#   BACKUP_LOCAL_DIR       받을 폴더(기본 ~/futureetp-backups, 저장소 밖). 최근 8개만 둔다
#   HEALTHCHECKS_PING_KEY  있으면 내려받기 check(slug backup_pull, 주기 7일 + 여유 2일)에 성공·실패 신호를 보낸다
# 값은 ~/.config/futureetp/ops.env에 둘 수 있다(scripts/ops-env.sh).
set -euo pipefail

source "$(dirname "$0")/ops-env.sh"

: "${DEPLOY_HOST:?DEPLOY_HOST를 지정하세요(예: ubuntu@203.0.113.10)}"
DEPLOY_DIR="${DEPLOY_DIR:-futureetp}"
BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-$HOME/futureetp-backups}"
LOCAL_KEEP=8
PING_SLUG=backup_pull
# BACKUP 작업의 파일 이름(jobs/backup.ts). 이름순 = 시간순
DUMP_PATTERN='^futureetp-[0-9]{8}T[0-9]{6}Z\.dump$'

fail() {
  echo "backup-pull: $*" >&2
  exit 1
}

# $1: 빈 값이면 성공, /fail이면 실패. 키가 든 URL은 출력하지 않는다
ping() {
  [[ -n "${HEALTHCHECKS_PING_KEY:-}" ]] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "https://hc-ping.com/${HEALTHCHECKS_PING_KEY}/${PING_SLUG}$1" 2>/dev/null ||
    echo "backup-pull: Healthchecks 신호를 보내지 못했습니다" >&2
}
trap 'status=$?; [[ $status -eq 0 ]] || ping /fail' EXIT

command -v pg_restore >/dev/null || fail "pg_restore가 없습니다(brew install postgresql@18)"

listing="$(ssh "$DEPLOY_HOST" "ls -1 $DEPLOY_DIR/infra/backups")"
latest="$(grep -E "$DUMP_PATTERN" <<<"$listing" | sort | tail -n 1 || true)"
[[ -n "$latest" ]] || fail "VM의 $DEPLOY_DIR/infra/backups에 덤프가 없습니다"

mkdir -p "$BACKUP_LOCAL_DIR"
chmod 700 "$BACKUP_LOCAL_DIR"
target="$BACKUP_LOCAL_DIR/$latest"
if [[ -f "$target" ]]; then
  echo "backup-pull: $latest 는 이미 받았습니다"
else
  # 덜 받은 파일이 보관 개수·복원에 끼지 않게 임시 이름으로 받은 뒤, 읽히는지 확인하고 바꾼다
  rsync -t "$DEPLOY_HOST:$DEPLOY_DIR/infra/backups/$latest" "$target.partial"
  pg_restore --list "$target.partial" >/dev/null || {
    rm -f "$target.partial"
    fail "$latest 를 덤프로 읽을 수 없습니다"
  }
  chmod 600 "$target.partial"
  mv "$target.partial" "$target"
  echo "backup-pull: $target ($(wc -c <"$target" | tr -d ' ') bytes)"
fi

ls -1 "$BACKUP_LOCAL_DIR" | grep -E "$DUMP_PATTERN" | sort -r | tail -n "+$((LOCAL_KEEP + 1))" | while read -r old; do
  rm -f "$BACKUP_LOCAL_DIR/$old"
  echo "backup-pull: $old 삭제"
done

ping ""
