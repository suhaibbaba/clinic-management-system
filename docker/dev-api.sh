#!/bin/sh
# Development entrypoint for the API container.
#
# Hot reload covers BOTH apps/api and packages/shared:
#   - tsc --watch rebuilds packages/shared into its dist
#   - nest build --watch rebuilds the API into its dist
#   - node --watch-path restarts the process when either dist changes
set -eu

cd /repo

echo "→ [api] syncing workspace dependencies"
pnpm install --frozen-lockfile --prefer-offline

# Signal the web container that the shared node_modules volumes are ready.
mkdir -p /var/lib/clinic-dev && touch /var/lib/clinic-dev/deps-ready

# Blocking first build: node needs a complete dist before it starts, otherwise
# it races the compiler and exits before anything has been emitted.
echo "→ [api] initial build"
pnpm --filter @clinic/shared build
pnpm --filter @clinic/api build

echo "→ [api] starting watchers"
pnpm --filter @clinic/shared dev &
pnpm --filter @clinic/api build --watch &

# Watch the build outputs explicitly instead of "files this process loaded", so
# a restart still happens after a bad compile made the process exit.
exec node \
  --watch-preserve-output \
  --watch-path=/repo/apps/api/dist \
  --watch-path=/repo/packages/shared/dist \
  /repo/apps/api/dist/main.js
