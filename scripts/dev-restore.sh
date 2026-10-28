#!/usr/bin/env bash
# prod 덤프를 로컬 dev DB에 복원한다(D-043, D-045). 저장소 루트에서: npm run dev:restore -- [덤프 파일] [--yes]
#   덤프를 주지 않으면 BACKUP_LOCAL_DIR(기본 ~/futureetp-backups)의 최신 덤프를 쓴다
#   대상은 DATABASE_URL 환경 변수, 없으면 apps/server/.env의 값. localhost가 아니면 거부한다
# public·drizzle 스키마를 지우고 덤프를 넣은 뒤 device(prod 푸시 토큰)와 보류 알림(HELD·RETRY)을 비우기까지
# 한 트랜잭션이다. 그 뒤 dev 스키마가 덤프보다 앞서 있을 수 있어 마이그레이션을 적용한다.
set -euo pipefail

source "$(dirname "$0")/ops-env.sh"

BACKUP_LOCAL_DIR="${BACKUP_LOCAL_DIR:-$HOME/futureetp-backups}"
DUMP_PATTERN='^futureetp-[0-9]{8}T[0-9]{6}Z\.dump$'

fail() {
  echo "dev-restore: $*" >&2
  exit 1
}

yes=false
dump=""
for arg in "$@"; do
  case "$arg" in
    --yes) yes=true ;;
    -*) fail "알 수 없는 옵션: $arg" ;;
    *) dump="$arg" ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"

if [[ -z "$dump" ]]; then
  [[ -d "$BACKUP_LOCAL_DIR" ]] || fail "$BACKUP_LOCAL_DIR 가 없습니다(npm run backup:pull)"
  latest="$(ls -1 "$BACKUP_LOCAL_DIR" | grep -E "$DUMP_PATTERN" | sort | tail -n 1 || true)"
  [[ -n "$latest" ]] || fail "$BACKUP_LOCAL_DIR 에 덤프가 없습니다(npm run backup:pull)"
  dump="$BACKUP_LOCAL_DIR/$latest"
fi
[[ -f "$dump" ]] || fail "$dump 가 없습니다"

# 접속 문자열은 비밀번호가 들 수 있어 출력하지 않는다
url="${DATABASE_URL:-}"
if [[ -z "$url" && -f apps/server/.env ]]; then
  url="$(grep -E '^DATABASE_URL=' apps/server/.env | tail -n 1 | cut -d= -f2- | tr -d "\"'")"
fi
[[ -n "$url" ]] || fail "DATABASE_URL이 없습니다(apps/server/.env)"
# prod DB를 덮어쓰지 않게 로컬 주소만 받는다
[[ "$url" =~ ^postgres(ql)?://([^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?/ ]] ||
  fail "DATABASE_URL이 로컬 DB가 아닙니다"
db_name="${url##*/}"
db_name="${db_name%%\?*}"

if [[ "$yes" != true ]]; then
  [[ -t 0 ]] || fail "확인할 수 없는 입력입니다. --yes를 붙이세요"
  read -r -p "dev DB '$db_name'를 $(basename "$dump")로 덮어씁니다. 계속할까요? [y/N] " answer
  [[ "$answer" == y || "$answer" == Y ]] || fail "취소했습니다"
fi

echo "dev-restore: $(basename "$dump") → $db_name"
# BEGIN·COMMIT을 직접 감싼다. pg_restore가 중간에 실패하면 COMMIT이 오지 않아 psql 종료와 함께 롤백된다.
# psql 오류에는 COPY 행(푸시 토큰 등)이 찍히지 않게 주 메시지만 출력한다
{
  echo 'BEGIN;'
  echo 'SET client_min_messages = warning;'
  echo 'DROP SCHEMA IF EXISTS drizzle CASCADE;'
  echo 'DROP SCHEMA IF EXISTS public CASCADE;'
  echo 'CREATE SCHEMA public;'
  pg_restore --no-owner --no-privileges -f - "$dump"
  # dev 서버가 prod 기기로 푸시를 보내지 않게 한다. pg_restore 출력이 search_path를 비우므로 스키마를 붙인다
  echo 'DELETE FROM public.device;'
  echo "DELETE FROM public.alert_record WHERE status IN ('HELD', 'RETRY');"
  echo 'COMMIT;'
} | psql -X -q -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never -d "$url" >/dev/null

npm run db:migrate -w apps/server --silent
echo "dev-restore: 완료. dev 앱은 다음 실행 때 기기를 다시 등록합니다"
