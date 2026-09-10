# syntax=docker/dockerfile:1.7
# Build context is the repository root: one pnpm workspace, so packages/shared is never duplicated
# per app.
ARG NODE_IMAGE=node:22.22-alpine

# Only the lockfile and manifests, so this layer is reused by every build that does not change a
# dependency.
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

# node_modules is excluded by .dockerignore, so the dependency layer survives the copy. pnpm builds
# packages/shared first.
FROM deps AS build

COPY . .

RUN pnpm --filter @clinic/api... build

# `pnpm deploy` yields a self-contained directory with @clinic/shared resolved into it. `--legacy`
# is required by the single shared lockfile.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @clinic/api deploy --prod --legacy /prod/api

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
