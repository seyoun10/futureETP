#!/usr/bin/env bash
# 마이그레이션 drift 검사(D-129). schema.ts를 바꾸고 `db:generate`를 빠뜨리면 실패한다.
# generate 전후 apps/server/drizzle의 파일 해시를 비교하므로, 아직 커밋하지 않은 새 마이그레이션이 있어도 맞으면 통과한다.
# drift가 있으면 generate가 만든 파일을 그대로 남겨 두니 내용을 확인하고 함께 커밋한다. DB 접속은 필요 없다.
set -euo pipefail
cd "$(dirname "$0")/../apps/server"

snapshot() { find drizzle -type f -print0 | sort -z | xargs -0 shasum; }

before=$(snapshot)
npx drizzle-kit generate >/dev/null
after=$(snapshot)

if [ "$before" != "$after" ]; then
  echo "schema.ts와 마이그레이션이 맞지 않아 drizzle-kit generate가 파일을 만들거나 바꿨다:" >&2
  diff <(echo "$before") <(echo "$after") | grep '^>' | awk '{print "  apps/server/" $3}' >&2
  echo "내용을 확인하고 함께 커밋한다." >&2
  exit 1
fi

# 마이그레이션 스냅숏끼리 충돌(브랜치 병합 등)이 없는지
npx drizzle-kit check >/dev/null
echo "migrations: schema.ts와 일치"
