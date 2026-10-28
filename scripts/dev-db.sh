# scripts/*.sh가 source한다. 로컬 dev DB 접속 문자열을 dev_url, DB 이름을 dev_db_name에 둔다(D-043).
# DATABASE_URL 환경 변수, 없으면 apps/server/.env의 값. localhost가 아니면 거부한다.
# 접속 문자열은 비밀번호가 들 수 있어 출력하지 않는다. 저장소 루트에서 source하고 fail 함수가 있어야 한다.
dev_url="${DATABASE_URL:-}"
if [[ -z "$dev_url" && -f apps/server/.env ]]; then
  dev_url="$(grep -E '^DATABASE_URL=' apps/server/.env | tail -n 1 | cut -d= -f2- | tr -d "\"'")"
fi
[[ -n "$dev_url" ]] || fail "DATABASE_URL이 없습니다(apps/server/.env)"
# prod DB를 dev로 착각하지 않게 로컬 주소만 받는다
[[ "$dev_url" =~ ^postgres(ql)?://([^@/]*@)?(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?/ ]] ||
  fail "DATABASE_URL이 로컬 DB가 아닙니다"
dev_db_name="${dev_url##*/}"
dev_db_name="${dev_db_name%%\?*}"
