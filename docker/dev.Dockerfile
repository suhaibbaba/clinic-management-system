# syntax=docker/dockerfile:1.7
#
# Single development image shared by the api and web services. The repository is
# bind-mounted over /repo at run time and node_modules live in named volumes, so
# this image only needs the toolchain plus a pre-warmed dependency tree that
# seeds those volumes on first start.
#
ARG NODE_IMAGE=node:22.22-alpine

FROM ${NODE_IMAGE}

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH

# Inotify does not reliably cross a bind mount; watchers poll instead.
ENV CHOKIDAR_USEPOLLING=true \
    WATCHPACK_POLLING=true

RUN corepack enable

WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# Full workspace install: this image runs both apps.
RUN pnpm install --frozen-lockfile

COPY docker/dev-api.sh docker/dev-web.sh docker/api-healthcheck.js /usr/local/bin/
RUN chmod +x /usr/local/bin/dev-api.sh /usr/local/bin/dev-web.sh

EXPOSE 3000 5173

CMD ["dev-api.sh"]
