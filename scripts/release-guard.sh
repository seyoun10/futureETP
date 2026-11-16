#!/usr/bin/env bash
# 배포 전 확인(D-131). deploy·update:prod·distribute:android가 먼저 실행한다. 저장소 루트 기준 HEAD를 본다.
#   ① 커밋되지 않은 변경이 없다(배포본 = 커밋 하나). 건너뛸 수 없다
#   ② HEAD가 origin/main에 들어 있다(push됨). main의 옛 커밋(되돌리기)도 통과
#   ③ 그 커밋의 check workflow가 성공으로 끝났다
# 급할 때(GitHub 장애 등)는 SKIP_CI_CHECK=1로 ②·③만 건너뛴다(경고 출력).
set -euo pipefail

fail() {
  echo "release-guard: $*" >&2
  exit 1
}

cd "$(git rev-parse --show-toplevel)"

# 추적하지 않는 파일도 EAS Update 번들·APK에 들어갈 수 있어 함께 본다
if [[ -n "$(git status --porcelain)" ]]; then
  fail "커밋되지 않은 변경이 있습니다. 커밋한 뒤 배포하세요"
fi

sha="$(git rev-parse HEAD)"
short="${sha:0:7}"

if [[ "${SKIP_CI_CHECK:-}" == 1 ]]; then
  echo "release-guard: 경고: SKIP_CI_CHECK=1이라 push·CI 확인을 건너뜁니다($short)" >&2
  exit 0
fi

skip_hint="(확인 없이 배포하려면 SKIP_CI_CHECK=1)"

git fetch --quiet origin main || fail "origin main을 가져오지 못했습니다 $skip_hint"
git merge-base --is-ancestor "$sha" origin/main ||
  fail "$short가 origin/main에 없습니다. push하고 npm run ci:wait로 CI 통과를 확인한 뒤 배포하세요"

# 같은 커밋에 push·workflow_dispatch 실행이 여럿이면 가장 최근 것을 본다(schedule은 check job을 건너뛰므로 제외)
run="$(gh run list --workflow=check.yml --commit "$sha" --limit 10 \
  --json databaseId,status,conclusion,event \
  -q '[.[] | select(.event != "schedule")][0] | "\(.databaseId) \(.status) \(.conclusion)"')" ||
  fail "gh로 CI 결과를 읽지 못했습니다 $skip_hint"

[[ -n "$run" && "$run" != "null null null" ]] || fail "$short의 check 실행이 없습니다 $skip_hint"
read -r run_id status conclusion <<<"$run"

[[ "$status" == completed ]] ||
  fail "$short의 CI가 아직 끝나지 않았습니다(실행 $run_id, $status). npm run ci:wait 뒤 다시 실행하세요"
# 연속 push로 cancel-in-progress에 취소된 커밋은 cancelled다. 다시 돌리려면 gh run rerun <id>
[[ "$conclusion" == success ]] ||
  fail "$short의 CI가 $conclusion입니다(gh run view $run_id). 통과한 커밋만 배포합니다"

echo "release-guard: $short push·CI 통과 확인(실행 $run_id)"
