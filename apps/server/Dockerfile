# 서버 이미지(D-034, D-051). 빌드 문맥은 저장소 루트: docker compose -f infra/docker-compose.yml build
# 빌드 단계 없이 Node 타입 스트리핑으로 src/main.ts를 바로 실행한다. shared는 workspaces 심볼릭 링크로 둔다.
# Alpine 3.23의 postgresql18-client가 BACKUP 작업의 pg_dump 18을 준다(D-045, D-053).
FROM node:26-alpine3.23

RUN apk add --no-cache postgresql18-client

WORKDIR /app
ENV NODE_ENV=production

# 의존성 층: lock 파일과 workspace package.json만 바뀔 때 다시 설치한다
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
# 루트 prepare(husky) 같은 설치 스크립트는 운영에 필요 없다
RUN npm ci --omit=dev --ignore-scripts --workspace apps/server --include-workspace-root=false \
  && npm cache clean --force

COPY packages/shared/src packages/shared/src
COPY apps/server/src apps/server/src
COPY apps/server/drizzle apps/server/drizzle

USER node
WORKDIR /app/apps/server
EXPOSE 3000
CMD ["node", "src/main.ts"]
