#!/bin/bash
# PostToolUse(Bash) hook: git commit 직후, 그 커밋이 형제 저장소(D-141)가 따라가야 할 파일을 바꿨으면
# 세 형제 저장소 TODO.md "원본 변경 반영"에 항목을 적으라고 Claude에게 알린다. 막지는 않는다.
input=$(cat)
cmd=$(echo "$input" | jq -r '.tool_input.command // ""')
echo "$cmd" | grep -qE '(^|[;&| ])git( -C [^ ]+)? commit' || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0

# 계약·화면 동작·공통 규칙의 원본 (테스트 파일 제외)
pattern='^(packages/shared/(src|contract)/|apps/server/src/api/|docs/(product|architecture|decisions)\.md|docs/wireframes/|\.claude/rules/mobile\.md|apps/mobile/src/i18n/locales/|eslint\.config\.mjs)'
files=$(git show --name-only --format= HEAD 2>/dev/null | grep -E "$pattern" | grep -vE '\.test\.tsx?$')
[ -z "$files" ] && exit 0

subject=$(git log -1 --format=%s HEAD)
list=$(echo "$files" | sed 's/^/  - /')
msg="커밋 $(git rev-parse --short HEAD) \"$subject\"가 형제 저장소가 따라갈 수 있는 파일을 바꿨다:
$list
API·shared 스키마·에러 코드·화면 동작·공통 규칙(레이어·문구 등) 변경이면 ../futureETP_FL·../futureETP_IOS·../futureETP_AOS의 TODO.md \"원본 변경 반영\"에 한 줄씩 적고(필요하면 각 docs/architecture.md도) 각 저장소에서 커밋한다. RN 내부 구현만 바뀐 것이면 넘어간다."
jq -n --arg m "$msg" '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: $m}}'
