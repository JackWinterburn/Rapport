# Single container: Node serves the API and the built PWA.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATABASE_PATH=/data/rapport.db
COPY --from=build /app /app
VOLUME /data
EXPOSE 8787
WORKDIR /app/apps/server
CMD ["npx", "tsx", "--disable-warning=ExperimentalWarning", "src/index.ts"]
