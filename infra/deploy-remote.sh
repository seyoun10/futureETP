#!/usr/bin/env bash
# VM에서 실행하는 배포 단계(D-048). scripts/deploy.sh가 rsync 뒤 ssh로 부른다.
# ② 이미지 빌드 → ③ pg_dump 덤프 → ④ 새 이미지의 일회성 컨테이너로 migrate → ⑤ 서버 교체.
# ④가 실패하면 ⑤를 하지 않아 이전 서버가 그대로 돈다(set -e).
set -euo pipefail

cd "$(dirname "$0")"

PREDEPLOY_DIR=predeploy
PREDEPLOY_KEEP=3
APP_UID=1000

fail() {
  echo "deploy: $*" >&2
  exit 1
}

[[ -f .env ]] || fail "infra/.env가 없습니다(.env.example을 복사해 채우고 chmod 600)"
[[ -f secrets/fcm-service-account.json ]] || fail "infra/secrets/fcm-service-account.json이 없습니다"

# 컨테이너 사용자 node(uid 1000)가 FCM 키를 읽고 덤프 폴더에 써야 한다
mkdir -p backups "$PREDEPLOY_DIR"
for path in backups secrets/fcm-service-account.json; do
  if [[ -z "$(find "$path" -maxdepth 0 -uid "$APP_UID")" ]]; then
    echo "deploy: $path 소유자를 uid ${APP_UID}로 바꿉니다"
    sudo -n chown "$APP_UID:$APP_UID" "$path" || fail "$path 소유자를 uid ${APP_UID}로 바꿔 주세요(sudo 필요)"
  fi
done

echo "deploy: ② 이미지 빌드"
docker compose build server

echo "deploy: ③ 배포 전 덤프"
docker compose up -d --wait db
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$PREDEPLOY_DIR/predeploy-$stamp.dump"
# 덜 쓴 파일이 남지 않게 임시 이름에 쓴 뒤 바꾼다
docker compose exec -T db pg_dump -U futureetp -Fc futureetp >"$dump.partial"
mv "$dump.partial" "$dump"
echo "deploy: $dump ($(wc -c <"$dump" | tr -d ' ') bytes)"
# 이름순 = 시간순. 최근 PREDEPLOY_KEEP개만 둔다
ls -1 "$PREDEPLOY_DIR"/predeploy-*.dump | sort -r | tail -n "+$((PREDEPLOY_KEEP + 1))" | while read -r old; do
  rm -f "$old"
done

echo "deploy: ④ 마이그레이션"
docker compose run --rm --no-deps server node src/db/migrate.ts

echo "deploy: ⑤ 서버 교체"
docker compose up -d --wait
docker image prune -f >/dev/null
docker compose ps
echo "deploy: 완료"
