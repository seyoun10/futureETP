#!/usr/bin/env bash
# VM에서 실행하는 서버 되돌리기(D-132). scripts/rollback.sh가 ssh로 부른다: rollback-remote.sh [커밋]
# 커밋을 주지 않으면 지금 배포본 직전에 돌았던 커밋으로 간다. 남겨 둔 커밋 이미지(IMAGE_KEEP개)만 가능하다.
# 마이그레이션 개수가 다르면 거부한다. 스키마는 앞으로만 가므로(D-053) 옛 코드가 새 스키마에서 돈다는 보장이 없다.
# 그때는 DB를 배포 전 덤프(infra/predeploy/)로 되돌리는 수동 복구가 필요하다.
set -euo pipefail

cd "$(dirname "$0")"
source ./image-lib.sh

fail() {
  echo "rollback: $*" >&2
  exit 1
}

current="$(current_commit)"
[[ -n "$current" ]] || fail "배포 기록($DEPLOY_LOG)이 없습니다. 기록이 생긴 뒤 배포본만 되돌릴 수 있습니다"
target="${1:-$(kept_commits | sed -n 2p)}"
[[ -n "$target" ]] || fail "되돌릴 이전 배포본이 없습니다"
[[ "$target" != "$current" ]] || fail "$target가 이미 지금 배포본입니다"
docker image inspect "$IMAGE:$target" >/dev/null 2>&1 ||
  fail "$IMAGE:$target 이미지가 없습니다. 남아 있는 것: $(kept_commits | tr '\n' ' ')"

now_count="$(migration_count latest)"
target_count="$(migration_count "$target")"
[[ "$now_count" == "$target_count" ]] ||
  fail "마이그레이션 개수가 다릅니다(지금 $now_count, $target $target_count). 자동으로 되돌리지 않습니다. 옛 커밋을 다시 배포하거나 predeploy 덤프로 수동 복구하세요"

echo "rollback: $current → $target"
docker tag "$IMAGE:$target" "$IMAGE:latest"
docker compose up -d --wait server
record_deploy rollback "$target"
docker compose ps server
echo "rollback: 완료 ($target)"
