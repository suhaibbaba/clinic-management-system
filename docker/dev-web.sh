#!/bin/sh
# Development entrypoint for the web container.
#
# The API container owns `pnpm install` — two concurrent installs would race on
# the shared node_modules volumes — so wait for its ready marker first.
# Vite resolves @clinic/shared to its TypeScript source, so editing the shared
# package hot-reloads the browser with no build step.
set -eu

cd /repo

echo "→ [web] waiting for workspace dependencies"
while [ ! -f /var/lib/clinic-dev/deps-ready ]; do
  sleep 1
done

exec pnpm --filter @clinic/web dev
