#!/usr/bin/env bash
# prod 서버 배포(D-048). Mac 저장소 루트에서: DEPLOY_HOST=ubuntu@<VM 주소> npm run deploy
#   DEPLOY_HOST  ssh 대상(필수). ssh 사용자는 docker 그룹에 있어야 한다
#   DEPLOY_DIR   VM의 배포 폴더(기본 futureetp, 홈 기준)
# 값은 ~/.config/futureetp/ops.env에 둘 수 있다(scripts/ops-env.sh).
# ① 커밋된 HEAD의 서버 관련 파일만 rsync하고 ②~⑤는 VM의 infra/deploy-remote.sh가 한다.
# VM에서만 관리하는 infra/.env·secrets/·backups/·predeploy/는 보내지도 지우지도 않는다.
set -euo pipefail

source "$(dirname "$0")/ops-env.sh"

: "${DEPLOY_HOST:?DEPLOY_HOST를 지정하세요(예: ubuntu@203.0.113.10)}"
DEPLOY_DIR="${DEPLOY_DIR:-futureetp}"

cd "$(git rev-parse --show-toplevel)"

# 미커밋 변경 거부, push·CI 통과 확인(D-131)
bash scripts/release-guard.sh
commit="$(git rev-parse --short HEAD)"

snapshot="$(mktemp -d)"
trap 'rm -rf "$snapshot"' EXIT
git archive HEAD package.json package-lock.json .dockerignore apps/server packages/shared infra scripts/calendar |
  tar -x -C "$snapshot"

echo "deploy: ① $commit → $DEPLOY_HOST:$DEPLOY_DIR"
rsync -az --delete \
  --exclude /infra/.env --exclude /infra/secrets/ --exclude /infra/backups/ --exclude /infra/predeploy/ \
  "$snapshot/" "$DEPLOY_HOST:$DEPLOY_DIR/"

ssh "$DEPLOY_HOST" "bash $DEPLOY_DIR/infra/deploy-remote.sh"
