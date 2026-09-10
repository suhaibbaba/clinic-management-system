# syntax=docker/dockerfile:1.7
ARG NODE_IMAGE=node:22.22-alpine
ARG NGINX_IMAGE=nginx:1.29-alpine

FROM ${NODE_IMAGE} AS deps

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

WORKDIR /repo

COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @clinic/web...

FROM deps AS build

# Same-origin API path; nginx proxies /api to the API container.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# The deploy resolves this from the commit count and passes it in; a plain `docker build` gets 0,
# since `.git` is not in the context.
ARG VITE_APP_VERSION=
ENV VITE_APP_VERSION=${VITE_APP_VERSION}

# Object storage's origin, so the HTML can preconnect and the clinic's logo starts its handshake
# during the bundle's download. Unset means no tag.
ARG VITE_STORAGE_ORIGIN=
ENV VITE_STORAGE_ORIGIN=${VITE_STORAGE_ORIGIN}

COPY . .

RUN pnpm --filter @clinic/web... build

FROM ${NGINX_IMAGE} AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD wget --quiet --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
