#!/usr/bin/env bash
# 첫 배포 뒤 빈 prod DB에 dev DB를 넣는다(D-100). 저장소 루트에서: npm run prod:seed -- [--yes]
#   DEPLOY_HOST  ssh 대상(필수), DEPLOY_DIR  VM의 배포 폴더(기본 futureetp, 홈 기준)
# 값은 ~/.config/futureetp/ops.env에 둘 수 있다(scripts/ops-env.sh). dev DB는 scripts/dev-db.sh가 정한다.
# 시세가 이미 있는 prod DB는 덮어쓰지 않는다. dev와 prod의 마이그레이션 수가 같아야 한다(먼저 npm run deploy).
# dev 기기 토큰(device)·시험 알림(alert_record)·실행 기록(batch_run)은 행을 빼고 옮긴다.
set -euo pipefail

source "$(dirname "$0")/ops-env.sh"

: "${DEPLOY_HOST:?DEPLOY_HOST를 지정하세요(예: ubuntu@203.0.113.10)}"
DEPLOY_DIR="${DEPLOY_DIR:-futureetp}"
EXCLUDED_DATA=(public.device public.alert_record public.batch_run)

fail() {
  echo "prod-seed: $*" >&2
  exit 1
}

yes=false
for arg in "$@"; do
  case "$arg" in
    --yes) yes=true ;;
    *) fail "알 수 없는 인자: $arg" ;;
  esac
done

cd "$(git rev-parse --show-toplevel)"
command -v pg_dump >/dev/null || fail "pg_dump가 없습니다(brew install postgresql@18)"
source scripts/dev-db.sh

# VM의 prod DB에 psql로 SQL을 보낸다(표준 입력). 오류에 데이터 행이 찍히지 않게 주 메시지만 출력한다
prod_psql() {
  ssh -C "$DEPLOY_HOST" "cd $DEPLOY_DIR/infra && docker compose exec -T db \
    psql -U futureetp -d futureetp -X -q -A -t -v ON_ERROR_STOP=1 -v VERBOSITY=terse -v SHOW_CONTEXT=never"
}

migrations_sql='SELECT count(*) FROM drizzle.__drizzle_migrations;'
dev_migrations="$(psql -X -A -t -d "$dev_url" -c "$migrations_sql")"
prod_migrations="$(prod_psql <<<"$migrations_sql")" || fail "prod DB를 읽지 못했습니다(먼저 npm run deploy)"
[[ "$dev_migrations" == "$prod_migrations" ]] ||
  fail "마이그레이션 수가 다릅니다(dev $dev_migrations, prod $prod_migrations). dev는 npm run db:migrate, prod는 npm run deploy로 맞추세요"

prod_bars="$(prod_psql <<<'SELECT (SELECT count(*) FROM public.daily_bar) + (SELECT count(*) FROM public.disparity);')"
[[ "$prod_bars" == 0 ]] || fail "prod DB에 이미 시세·이격도가 있습니다(${prod_bars}행). 첫 배포 때만 씁니다"

if [[ "$yes" != true ]]; then
  [[ -t 0 ]] || fail "확인할 수 없는 입력입니다. --yes를 붙이세요"
  read -r -p "${DEPLOY_HOST}의 prod DB를 dev DB '$dev_db_name'로 채웁니다. 계속할까요? [y/N] " answer
  [[ "$answer" == y || "$answer" == Y ]] || fail "취소했습니다"
fi

# 넣는 동안 스케줄러가 쓰지 않게 서버를 멈추고, 성공·실패와 관계없이 다시 띄운다
echo "prod-seed: 서버 정지"
ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR/infra && docker compose stop server"
trap 'echo "prod-seed: 서버 시작"; ssh "$DEPLOY_HOST" "cd $DEPLOY_DIR/infra && docker compose up -d --wait server"' EXIT

echo "prod-seed: dev '$dev_db_name' → $DEPLOY_HOST"
# BEGIN·COMMIT을 직접 감싼다. pg_dump가 중간에 실패하면 COMMIT이 오지 않아 psql 종료와 함께 롤백된다
exclude_args=()
for table in "${EXCLUDED_DATA[@]}"; do
  exclude_args+=(--exclude-table-data="$table")
done
{
  echo 'BEGIN;'
  echo 'SET client_min_messages = warning;'
  echo 'DROP SCHEMA IF EXISTS drizzle CASCADE;'
  echo 'DROP SCHEMA IF EXISTS public CASCADE;'
  echo 'CREATE SCHEMA public;'
  pg_dump --no-owner --no-privileges "${exclude_args[@]}" -d "$dev_url"
  echo 'COMMIT;'
} | prod_psql >/dev/null

echo "prod-seed: 완료(daily_bar $(prod_psql <<<'SELECT count(*) FROM public.daily_bar;')행). 앱은 다음 실행 때 기기를 등록합니다"
