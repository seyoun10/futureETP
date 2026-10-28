# scripts/*.sh가 source한다. 저장소 밖 운영 설정 파일(KEY=VALUE 한 줄씩)을 읽는다.
# 기본 위치 ~/.config/futureetp/ops.env(권한 600). 이미 지정된 환경 변수는 덮어쓰지 않는다.
#   예: DEPLOY_HOST=ubuntu@203.0.113.10
OPS_ENV_FILE="${OPS_ENV_FILE:-$HOME/.config/futureetp/ops.env}"
if [[ -f "$OPS_ENV_FILE" ]]; then
  while IFS='=' read -r key value || [[ -n "$key" ]]; do
    [[ "$key" =~ ^[A-Z_][A-Z0-9_]*$ ]] || continue
    [[ -n "${!key:-}" ]] || export "$key=$value"
  done <"$OPS_ENV_FILE"
fi
