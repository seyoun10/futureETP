#!/usr/bin/env bash
# 커버리지 측정(추세 확인용). 결과는 각 workspace의 coverage/ 아래에 쌓인다.
# 서버·shared 하한은 각 vitest.config.ts에 있어 여기서도 적용된다(D-127). 앱은 하한 없이 추세만 본다.
# 앱은 CLI 인자로만 넘긴다. apps/mobile/package.json을 바꾸면 fingerprint가 바뀌어 OTA를 못 받는다.
set -euo pipefail
cd "$(dirname "$0")/.."

for workspace in apps/server packages/shared; do
  npm test -w "$workspace" -- --coverage --coverage.reporter=text-summary \
    --coverage.reporter=json-summary
done

npm test -w apps/mobile -- --silent --coverage --coverageReporters=text-summary \
  --coverageReporters=json-summary \
  --collectCoverageFrom='src/**/*.{ts,tsx}' --collectCoverageFrom='!src/**/*.d.ts'
