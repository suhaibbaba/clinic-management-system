#!/bin/sh
# The API container owns `pnpm install` — two concurrent installs would race on the shared volumes
# — so wait for its ready marker.
set -eu

cd /repo

echo "→ [web] waiting for workspace dependencies"
while [ ! -f /var/lib/clinic-dev/deps-ready ]; do
  sleep 1
done

exec pnpm --filter @clinic/web dev
