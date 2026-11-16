#!/usr/bin/env bash
# prod에서 지금 서빙 중인 서버 커밋과, 그 뒤 HEAD까지 서버 배포 대상 경로의 변경을 보여 준다(D-132). 읽기 전용.
#   npm run deploy:status
set -euo pipefail

source "$(dirname "$0")/ops-env.sh"
source "$(dirname "$0")/public-health.sh"

cd "$(git rev-parse --show-toplevel)"

deployed="$(public_commit)" || {
  echo "deploy-status: $DEPLOY_URL/v1/health 응답 없음" >&2
  exit 1
}
echo "서빙 중: $deployed ($DEPLOY_URL)"
if ! git cat-file -e "$deployed^{commit}" 2>/dev/null; then
  echo "이 저장소에 없는 커밋입니다(D-132 이전 배포본이면 unknown)"
  exit 0
fi
# deploy.sh가 VM에 보내는 경로와 같다
changes="$(git log --oneline "$deployed..HEAD" -- package.json package-lock.json .dockerignore apps/server packages/shared infra scripts/calendar)"
if [[ -z "$changes" ]]; then
  echo "HEAD까지 서버 배포 대상 변경 없음"
else
  echo "배포 안 된 서버 변경:"
  echo "$changes"
fi
