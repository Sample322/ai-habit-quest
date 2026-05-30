# syntax=docker/dockerfile:1.7
# Use Debian-slim (not Alpine) — Prisma's schema engine needs libssl, which
# Debian ships out of the box and Alpine does not. ~30 MB larger, much more
# reliable for Prisma workloads in production.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build with the full toolchain, then strip dev dependencies from node_modules
# so the RUNTIME image stays small. The big offenders (typescript, webpack via
# @nestjs/cli, ts-loader, ts-node, @types) are dev-only and must not ship —
# a bloated image makes Timeweb's registry pull exceed the deploy window and
# the deploy is marked "failed" even though the container starts fine.
# `prisma` is a prod dependency (needed for `db push` at startup), so it
# survives the prune; we regenerate the client afterwards to be safe.
RUN npx prisma generate \
  && npm run build \
  && npm prune --omit=dev \
  && npx prisma generate

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# curl + wget so any platform healthcheck command can run. We do NOT ship a
# HEALTHCHECK directive of our own — Timeweb Cloud Apps injects its own
# healthcheck based on the path you set in the UI, and having two competing
# healthchecks leaves the container stuck in "unhealthy".
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates curl wget \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3001
# `db push` syncs schema.prisma -> DB in one shot. No migration files needed
# for Phase 1. We will switch to `migrate deploy` once the schema is stable
# and we generate the first proper migration set.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/main.js"]
