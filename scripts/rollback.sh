#!/usr/bin/env bash
# prod 서버를 이전 배포본으로 되돌린다(D-132). 저장소 루트에서:
#   npm run deploy:rollback -- [커밋]   기본은 직전 배포본. VM에 남은 커밋 이미지만 가능
# 마이그레이션 개수가 다르면 VM 쪽(infra/rollback-remote.sh)이 거부한다. DB는 건드리지 않는다.
set -euo pipefail

source "$(dirname "$0")/ops-env.sh"
source "$(dirname "$0")/public-health.sh"

: "${DEPLOY_HOST:?DEPLOY_HOST를 지정하세요(예: ubuntu@203.0.113.10)}"
DEPLOY_DIR="${DEPLOY_DIR:-futureetp}"
target="${1:-}"
[[ -z "$target" || "$target" =~ ^[0-9a-f]{7,40}$ ]] || {
  echo "rollback: 커밋 해시 형식이 아닙니다: $target" >&2
  exit 1
}

out="$(ssh "$DEPLOY_HOST" "bash $DEPLOY_DIR/infra/rollback-remote.sh $target" | tee /dev/stderr)"
wait_public_health "$(sed -nE 's/^rollback: 완료 \(([0-9a-f]+)\)$/\1/p' <<<"$out")"
