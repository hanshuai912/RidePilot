# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install --global --fetch-retries=5 --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000 --fetch-timeout=300000 pnpm@11.28.0

COPY . .

RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile \
    && pnpm --filter @ridepilot/contracts build \
    && DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @ridepilot/api db:generate \
    && pnpm --filter @ridepilot/api build \
    && useradd --system --create-home ridepilot \
    && chown -R ridepilot:ridepilot /app

USER ridepilot

EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
