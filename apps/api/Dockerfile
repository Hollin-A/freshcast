# The API's production image (#32). Build from the repository root:
#
#   docker build -f apps/api/Dockerfile --build-arg APP_VERSION=$(git rev-parse HEAD) -t freshcast-api .
#
# Fargate runs it on ARM64 (ADR-021 §1). It holds no secrets: DATABASE_URL,
# AUTH_SECRET and the rest come from the environment when it starts
# (ADR-018). It doesn't run database migrations; deploys run them as their
# own step (#34).

FROM node:24-alpine AS base
WORKDIR /app
RUN corepack enable

# Stage 1: a partial monorepo with only the API and the workspace packages it
# depends on, and a lockfile pruned to match. Unrelated changes (the App's
# dependencies, docs) then don't invalidate the install layer below.
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.7 prune @freshcast/api --docker

# Stage 2: install from the pruned manifests, then build the API and its
# workspace dependencies.
FROM base AS build
COPY --from=prune /app/out/json/ .
# Install scripts need the sources (prisma generate reads the schema), so
# they run after the full copy.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY --from=prune /app/out/full/ .
RUN pnpm rebuild
RUN pnpm turbo run build --filter=@freshcast/api
# A self-contained copy of the API with production dependencies, at the
# lockfile's versions. The workspace packages are copied in (injected) with
# their built dist/. Don't use --legacy: it resolves the version ranges again
# and ignores the lockfile, so the image would ship whatever npm has newest.
# The lockfile resolves @prisma/client's optional peers, so the Prisma CLI
# and TypeScript come along; nothing in the image runs them. Scripts are
# skipped: the client is already generated in dist/.
RUN pnpm --filter=@freshcast/api deploy --prod --config.inject-workspace-packages=true --ignore-scripts /prod/api

# Stage 3: the runtime image.
FROM node:24-alpine AS runtime
# tini runs as PID 1: it forwards SIGTERM from ECS to Node, which runs the
# shutdown hooks (main.ts), and reaps zombie processes.
RUN apk add --no-cache tini
WORKDIR /app
ENV NODE_ENV=production
# The git SHA, reported by /health/live. Empty counts as unset, and the API
# reports its package.json version instead.
ARG APP_VERSION=""
ENV APP_VERSION=${APP_VERSION}
COPY --from=build --chown=node:node /prod/api ./
# The image's built-in non-root user.
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
