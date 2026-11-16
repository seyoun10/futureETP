#!/usr/bin/env bash
# 서버 이미지 smoke(D-133). CI가 push·PR마다 VM과 같은 arm64에서 돌린다. Docker가 있으면 로컬에서도 같다:
#   bash scripts/server-image-smoke.sh
# 운영 배포(infra/deploy-remote.sh)의 ②·④·⑤를 빈 DB로 흉내 낸다:
#   이미지 빌드 → 빈 postgres:18에 migrate 두 번(두 번째는 재배포처럼 할 일 없음) → 서버 시작 →
#   health가 빌드 커밋을 보내는지, 인증된 요청이 마이그레이션된 스키마를 읽는지 확인한다.
# 외부 키·FCM·스케줄러 없이 시작한다. 실패하면 서버 로그를 보여 준다.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

commit="$(git rev-parse --short HEAD)"
image="futureetp-server:smoke"
name="futureetp-smoke-$$"
net="$name"
port="${SMOKE_PORT:-3300}"
pg_password=smoke
token="$(printf 'smoke%.0s' {1..8})" # 40자. API_TOKEN 최소 32자
device=00000000-0000-4000-8000-000000000000
db_url="postgres://postgres:$pg_password@$name-db:5432/futureetp"

cleanup() {
  local status=$?
  if ((status != 0)) && docker container inspect "$name-server" >/dev/null 2>&1; then
    echo "smoke: 서버 로그" >&2
    docker logs "$name-server" >&2 || true
  fi
  docker rm -f "$name-server" "$name-db" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

fail() {
  echo "smoke: $*" >&2
  exit 1
}

echo "smoke: ① 이미지 빌드 ($commit)"
docker build -f apps/server/Dockerfile --build-arg "GIT_COMMIT=$commit" -t "$image" .
[[ "$(docker image inspect -f '{{index .Config.Labels "futureetp.commit"}}' "$image")" == "$commit" ]] ||
  fail "이미지 label futureetp.commit이 $commit이 아닙니다"

echo "smoke: ② 빈 DB 시작"
docker network create "$net" >/dev/null
docker run -d --name "$name-db" --network "$net" \
  -e POSTGRES_DB=futureetp -e POSTGRES_PASSWORD="$pg_password" \
  --health-cmd 'pg_isready -U postgres -d futureetp' --health-interval 2s --health-retries 30 \
  postgres:18 >/dev/null
for _ in $(seq 60); do
  [[ "$(docker inspect -f '{{.State.Health.Status}}' "$name-db")" == healthy ]] && break
  sleep 1
done
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$name-db")" == healthy ]] || fail "postgres가 60초 안에 준비되지 않았습니다"

run_env=(-e NODE_ENV=production -e "DATABASE_URL=$db_url" -e "API_TOKEN=$token" -e SCHEDULER_ENABLED=false)

echo "smoke: ③ 마이그레이션(두 번)"
for _ in 1 2; do
  docker run --rm --network "$net" "${run_env[@]}" "$image" node src/db/migrate.ts
done

echo "smoke: ④ 서버 시작"
docker run -d --name "$name-server" --network "$net" -p "127.0.0.1:$port:3000" "${run_env[@]}" "$image" >/dev/null
base="http://127.0.0.1:$port/v1"
got=''
for _ in $(seq 30); do
  got="$(curl -fsS --max-time 2 "$base/health" 2>/dev/null | jq -er '.data.commit' 2>/dev/null || true)"
  [[ -n "$got" ]] && break
  docker container inspect -f '{{.State.Running}}' "$name-server" | grep -q true || fail "서버 컨테이너가 종료됐습니다"
  sleep 1
done
[[ "$got" == "$commit" ]] || fail "health가 30초 안에 $commit을 보내지 않았습니다(받은 값: ${got:-없음})"
echo "smoke: health $got"

# 인증·기기 헤더·DB 조회를 거친다. 빈 DB면 기본 설정이 온다
curl -fsS --max-time 5 -H "Authorization: Bearer $token" -H "X-Device-Id: $device" "$base/settings" |
  jq -e '.success == true' >/dev/null || fail "GET /v1/settings가 성공 봉투를 보내지 않았습니다"
# 토큰이 틀리면 401
status="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 -H 'Authorization: Bearer wrong' "$base/settings")"
[[ "$status" == 401 ]] || fail "틀린 토큰에 401이 아니라 $status를 보냈습니다"

echo "smoke: 통과 ($commit)"
