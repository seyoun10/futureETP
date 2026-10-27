#!/bin/bash
# Stop hook: 커밋 전 변경(스테이징 포함·미추적)에 TS 파일이 있는 workspace만 타입 검사한다.
# 실패하면 exit 2로 오류를 Claude에게 돌려줘 고치게 한다 (D-057).
input=$(cat)
# 이미 이 hook 때문에 이어서 작업 중이면 다시 막지 않는다(무한 반복 방지)
[ "$(echo "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

cd "$CLAUDE_PROJECT_DIR" || exit 0
changed=$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null | grep -E '\.(ts|tsx)$')
[ -z "$changed" ] && exit 0

status=0
for ws in apps/mobile apps/server packages/shared; do
  if echo "$changed" | grep -q "^$ws/"; then
    if ! out=$(npm run typecheck -w "$ws" 2>&1); then
      echo "[$ws] typecheck 실패:" >&2
      echo "$out" | grep -E 'error TS' >&2
      status=2
    fi
  fi
done
exit $status
