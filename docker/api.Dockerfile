# syntax=docker/dockerfile:1.7
#
# API image. Build context is the REPOSITORY ROOT — the whole pnpm workspace is
# one build context, so packages/shared is never duplicated per app:
#
#   docker build -f docker/api.Dockerfile -t clinic-api .
#
ARG NODE_IMAGE=node:22.22-alpine

# ---------------------------------------------------------------------------
# Stage 1 — dependencies. Only the lockfile and the package manifests are copied,
# so this layer is reused on every build that does not change a dependency.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# `@clinic/api...` = the API plus its workspace dependencies (packages/shared);
# the web app's dependencies are never installed into this image.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @clinic/api...

# ---------------------------------------------------------------------------
# Stage 2 — build. The whole workspace is copied over the dependency layer
# (node_modules is excluded by .dockerignore, so it survives) and only the API
# is built. pnpm builds packages/shared first because the API depends on it.
# ---------------------------------------------------------------------------
FROM deps AS build

COPY . .

RUN pnpm --filter @clinic/api... build

# `pnpm deploy` produces a self-contained directory: the API's own files plus a
# production-only node_modules with @clinic/shared resolved into it, no symlinks
# back to the workspace. `--legacy` is required because the workspace uses a
# single shared lockfile rather than injected dependencies.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @clinic/api deploy --prod --legacy /prod/api

# ---------------------------------------------------------------------------
# Stage 3 — runtime. No pnpm, no sources, no build tooling.
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=build --chown=node:node /prod/api ./
COPY --chown=node:node docker/api-healthcheck.js /usr/local/bin/api-healthcheck.js

USER node
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD ["node", "/usr/local/bin/api-healthcheck.js"]

# Migrations are run explicitly before start in docker-compose.prod.yml, so this
# image stays usable for one-off commands (e.g. `node dist/database/migrate.js`).
CMD ["node", "dist/main.js"]
