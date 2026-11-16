#!/bin/bash
# push한 커밋의 CI(check workflow)가 끝날 때까지 기다리고 결과로 끝난다(D-130). 저장소 루트에서:
#   npm run ci:wait [-- <커밋>]   기본은 HEAD. 성공 0, 실패 1(실패한 job 로그 끝부분 출력)
# push 직후에는 실행이 아직 안 보일 수 있어 최대 2분 동안 찾는다.
set -euo pipefail

sha=$(git rev-parse "${1:-HEAD}")
run_id=''
for _ in $(seq 24); do
  run_id=$(gh run list --workflow=check.yml --commit "$sha" --limit 1 --json databaseId -q '.[0].databaseId')
  [ -n "$run_id" ] && break
  sleep 5
done
if [ -z "$run_id" ]; then
  echo "ci-wait: ${sha:0:7}의 check 실행을 찾지 못했다(push했는지 확인)" >&2
  exit 1
fi

echo "ci-wait: ${sha:0:7} 실행 $run_id 대기"
if gh run watch "$run_id" --exit-status --interval 15 >/dev/null; then
  echo "ci-wait: 통과"
else
  # 실패 로그 끝에는 서비스 컨테이너(Postgres) 로그가 붙으므로 끝부분 대신 실패 표시 줄만 추린다
  echo "ci-wait: 실패. 실패 표시 줄(전체: gh run view $run_id --log-failed):" >&2
  gh run view "$run_id" --log-failed |
    sed -E 's/\x1b\[[0-9;]*m//g; s/^[^\t]*\t[^\t]*\t[^ ]+ //' |
    grep -E '^ *(FAIL|✗|×|●)|error TS|\[error\]|npm error Lifecycle|ERR_|Error:' |
    awk '!seen[$0]++' | head -40 >&2 || true
  exit 1
fi
