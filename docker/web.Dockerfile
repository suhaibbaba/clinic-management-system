# syntax=docker/dockerfile:1.7
#
# Web image. Build context is the REPOSITORY ROOT (same single-context workspace
# pattern as the API — packages/shared exists once):
#
#   docker build -f docker/web.Dockerfile -t clinic-web .
#
ARG NODE_IMAGE=node:22.22-alpine
ARG NGINX_IMAGE=nginx:1.29-alpine

# ---------------------------------------------------------------------------
# Stage 1 — dependencies, cached on the lockfile and manifests alone.
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

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @clinic/web...

# ---------------------------------------------------------------------------
# Stage 2 — build only the web app (packages/shared is built once as its
# workspace dependency).
# ---------------------------------------------------------------------------
FROM deps AS build

# Same-origin API path; nginx proxies /api to the API container.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY . .

RUN pnpm --filter @clinic/web... build

# ---------------------------------------------------------------------------
# Stage 3 — runtime: static assets on nginx, no Node.
# ---------------------------------------------------------------------------
FROM ${NGINX_IMAGE} AS runtime

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=5 \
    CMD wget --quiet --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
