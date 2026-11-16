# deploy-remote.sh·rollback-remote.sh가 source한다(D-132). infra/에서 실행한다고 가정한다.
# 배포 기록 deploys.log: 한 줄에 "<UTC 시각> <deploy|rollback> <커밋>". 마지막 줄이 지금 도는 배포본이다.
# VM에서만 관리하고 rsync로 보내지도 지우지도 않는다(scripts/deploy.sh exclude).
IMAGE=futureetp-server
DEPLOY_LOG=deploys.log
IMAGE_KEEP=3

record_deploy() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $1 $2" >>"$DEPLOY_LOG"
}

current_commit() {
  [[ -f "$DEPLOY_LOG" ]] && tail -n 1 "$DEPLOY_LOG" | awk '{print $3}'
}

# 최근에 돌았던 커밋 IMAGE_KEEP개(최신 먼저, 중복 제거). 이 커밋들의 이미지만 남긴다
kept_commits() {
  [[ -f "$DEPLOY_LOG" ]] || return 0
  tac "$DEPLOY_LOG" | awk '!seen[$3]++ {print $3}' | head -n "$IMAGE_KEEP"
}

prune_commit_images() {
  local keep tag
  keep="$(kept_commits)"
  docker image ls "$IMAGE" --format '{{.Tag}}' | while read -r tag; do
    [[ "$tag" == latest || "$tag" == '<none>' ]] && continue
    grep -qxF "$tag" <<<"$keep" || docker rmi "$IMAGE:$tag" >/dev/null || true
  done
}

# 이미지에 들어 있는 마이그레이션 개수(drizzle journal 항목 수)
migration_count() {
  docker run --rm --entrypoint node "$IMAGE:$1" \
    -e "console.log(require('/app/apps/server/drizzle/meta/_journal.json').entries.length)"
}
