#!/usr/bin/env bash
# prod 배치 작업의 최근 실행 기록(batch_run)과 마지막 실행 동안의 그 작업 로그를 본다(읽기 전용).
# 저장소 루트에서: npm run batch:result -- [작업 이름(기본 SETTLE_BACKFILL)] [기록 개수(기본 5)]
#   DEPLOY_HOST  ssh 대상(필수)
#   DEPLOY_DIR   VM의 배포 폴더(기본 futureetp, 홈 기준)
# 값은 ~/.config/futureetp/ops.env에 둘 수 있다(scripts/ops-env.sh).
set -euo pipefail

source "$(dirname "$0")/ops-env.sh"

: "${DEPLOY_HOST:?DEPLOY_HOST를 지정하세요(예: ubuntu@203.0.113.10)}"
DEPLOY_DIR="${DEPLOY_DIR:-futureetp}"
JOB="${1:-SETTLE_BACKFILL}"
LIMIT="${2:-5}"

# 작업 이름(packages/shared/src/domain.ts의 JOB_NAMES) → 그 작업이 남기는 로그 줄 접두어
case "$JOB" in
  DAILY_SETTLE) PREFIX='settle|recompute|alert' ;;
  SETTLE_REVISION) PREFIX='revision|recompute|alert' ;;
  SETTLE_BACKFILL) PREFIX='backfill|recompute' ;;
  INTRADAY) PREFIX='intraday' ;;
  DEFERRED_PUSH) PREFIX='deferred' ;;
  ETP) PREFIX='etp' ;;
  CALENDAR) PREFIX='calendar' ;;
  BACKUP) PREFIX='backup' ;;
  *)
    echo "batch-result: 모르는 작업 이름입니다: $JOB" >&2
    exit 1
    ;;
esac
[[ "$LIMIT" =~ ^[1-9][0-9]*$ ]] || {
  echo "batch-result: 기록 개수는 양의 정수여야 합니다: $LIMIT" >&2
  exit 1
}

# 작업 이름·개수는 위에서 검사한 값만 원격 SQL에 넣는다
# ssh는 인자를 이어 붙여 원격 셸에 넘기므로 하나씩 따옴표 처리한다(접두어의 | 때문)
ssh "$DEPLOY_HOST" "bash -s -- $(printf '%q ' "$DEPLOY_DIR" "$JOB" "$LIMIT" "$PREFIX")" <<'REMOTE'
set -euo pipefail
dir="$1" job="$2" limit="$3" prefix="$4"
cd "$dir/infra"
# 원격 스크립트를 stdin(bash -s)으로 받으므로 docker 명령이 stdin을 먹지 않게 막는다
psql() { docker compose exec -T db psql -U futureetp -d futureetp "$@" </dev/null; }

echo "== batch_run $job (최근 $limit개, 시각 UTC)"
psql -c "select trade_date, started_at, finished_at - started_at as duration, status, attempt,
           left(error, 200) as error
         from batch_run where job = '$job' order by started_at desc limit $limit"

# 마지막 실행 구간(재시도 포함: 같은 거래일의 첫 시작 ~ 마지막 끝, 진행 중이면 지금까지)
window="$(psql -At -F ' ' -c "
  with last as (
    select trade_date, started_at from batch_run where job = '$job' order by started_at desc limit 1
  )
  select to_char(min(b.started_at) at time zone 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'),
         to_char(coalesce(max(b.finished_at), now()) at time zone 'UTC' + interval '1 minute',
                 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')
  from batch_run b, last
  where b.job = '$job'
    and b.trade_date is not distinct from last.trade_date
    and b.started_at >= last.started_at - interval '1 day'")"
read -r since until <<<"$window"
if [[ -z "${since:-}" ]]; then
  echo "== 실행 기록이 없습니다"
  exit 0
fi

echo
echo "== 로그 $since ~ $until ([${prefix//|/, [} 줄)"
docker compose logs </dev/null --no-color --no-log-prefix --since "$since" --until "$until" server 2>&1 |
  grep -E "^\[($prefix)[] ]" || echo "(해당 로그 없음. 로그 보관(10MB × 3)이 지났을 수 있음)"
REMOTE
