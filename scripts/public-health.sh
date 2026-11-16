# deploy.sh·rollback.sh·deploy-status.sh가 source한다(D-132). Caddy·TLS·도메인을 거치는 실제 경로로 health를 본다.
#   DEPLOY_URL  prod API 주소. 기본은 앱 app.config.ts의 PROD_API_URL과 같은 값(바꾸면 둘 다)
DEPLOY_URL="${DEPLOY_URL:-https://futureetp-api.duckdns.org}"

# 지금 서빙 중인 커밋을 출력한다. 응답이 없거나 실패 봉투면 1
public_commit() {
  curl -fsS --max-time 5 "$DEPLOY_URL/v1/health" | jq -er '.data.commit // "unknown"'
}

# 외부 health가 기대 커밋을 보낼 때까지 최대 60초 기다린다
wait_public_health() {
  local want="$1" got=''
  for _ in $(seq 12); do
    got="$(public_commit 2>/dev/null || true)"
    if [[ "$got" == "$want" ]]; then
      echo "health: $DEPLOY_URL 서빙 중 $got"
      return 0
    fi
    sleep 5
  done
  echo "health: $DEPLOY_URL가 60초 동안 $want를 보내지 않았습니다(마지막 응답: ${got:-없음}). Caddy·DNS·서버 로그를 확인하세요" >&2
  return 1
}
