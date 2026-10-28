#!/usr/bin/env bash
# prod 서버 배포(D-048). Mac 저장소 루트에서: DEPLOY_HOST=ubuntu@<VM 주소> npm run deploy
#   DEPLOY_HOST  ssh 대상(필수). ssh 사용자는 docker 그룹에 있어야 한다
#   DEPLOY_DIR   VM의 배포 폴더(기본 futureetp, 홈 기준)
# ① 커밋된 HEAD의 서버 관련 파일만 rsync하고 ②~⑤는 VM의 infra/deploy-remote.sh가 한다.
# VM에서만 관리하는 infra/.env·secrets/·backups/·predeploy/는 보내지도 지우지도 않는다.
set -euo pipefail

: "${DEPLOY_HOST:?DEPLOY_HOST를 지정하세요(예: ubuntu@203.0.113.10)}"
DEPLOY_DIR="${DEPLOY_DIR:-futureetp}"

cd "$(git rev-parse --show-toplevel)"

# 커밋되지 않은 변경은 배포하지 않는다(배포본 = 커밋 하나)
if ! git diff --quiet HEAD --; then
  echo "deploy: 커밋되지 않은 변경이 있습니다. 커밋한 뒤 배포하세요" >&2
  exit 1
fi
commit="$(git rev-parse --short HEAD)"

snapshot="$(mktemp -d)"
trap 'rm -rf "$snapshot"' EXIT
git archive HEAD package.json package-lock.json .dockerignore apps/server packages/shared infra |
  tar -x -C "$snapshot"

echo "deploy: ① $commit → $DEPLOY_HOST:$DEPLOY_DIR"
rsync -az --delete \
  --exclude /infra/.env --exclude /infra/secrets/ --exclude /infra/backups/ --exclude /infra/predeploy/ \
  "$snapshot/" "$DEPLOY_HOST:$DEPLOY_DIR/"

ssh "$DEPLOY_HOST" "bash $DEPLOY_DIR/infra/deploy-remote.sh"
