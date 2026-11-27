# The API's production image (#32). Build from the repository root:
#
#   docker build -f apps/api/Dockerfile -t freshcast-api .
#
# Fargate runs it on ARM64 (ADR-021). It holds no secrets: DATABASE_URL,
# AUTH_SECRET and the rest come from the environment when it starts
# (ADR-018). It doesn't run database migrations.

FROM node:24-alpine AS base
WORKDIR /app
# pnpm at the version in package.json's packageManager field.
RUN corepack enable

# Stage 1: a partial monorepo with only the API, the workspace packages it
# depends on and a lockfile trimmed to match. out/json holds just the
# package.json files, out/full the sources too. Changes elsewhere (the App's
# dependencies, docs) then don't invalidate the install layer below.
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.7 prune @freshcast/api --docker

# Stage 2: install, build, then collect what runs in production.
FROM base AS build
# Manifests first: this layer and the install are reused until a dependency
# changes.
COPY --from=prune /app/out/json/ .
# Scripts are skipped here because they need the sources (Prisma's
# postinstall reads the schema); `pnpm rebuild` runs them after the copy.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY --from=prune /app/out/full/ .
RUN pnpm rebuild
# Builds @freshcast/db (prisma generate, tsc) and @freshcast/shared, then the API.
RUN pnpm turbo run build --filter=@freshcast/api
# A self-contained copy of the API in /prod/api with production dependencies
# only, at the lockfile's versions. Workspace packages are copied in
# (injected) with their built dist/ rather than symlinked. Don't add
# --legacy: it ignores the lockfile and resolves versions again.
RUN pnpm --filter=@freshcast/api deploy --prod --ignore-scripts \
      --config.inject-workspace-packages=true /prod/api

# Stage 3: the runtime image. Only Node, tini and the deployed API.
FROM node:24-alpine AS runtime
# Alpine's security fixes reach its package repository before the Node
# base image is rebuilt, so upgrade the base packages at build time. CI
# builds this stage with no cache (no-cache-filters: runtime) so the upgrade
# runs on every build; locally, use `--no-cache-filter runtime`.
# tini runs as PID 1: it forwards SIGTERM from ECS to Node so the shutdown
# hooks in main.ts run, and reaps zombie processes.
RUN apk upgrade --no-cache && apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /prod/api ./
# The image's built-in non-root user.
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
