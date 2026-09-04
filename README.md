# Clinic Management System

Multi-clinic, multi-specialty clinic management system. Arabic (RTL) web UI, NestJS API,
PostgreSQL. See [CLAUDE.md](./CLAUDE.md) for architecture rules and [ROLES.md](./ROLES.md)
for the authorization spec.

> **Status: skeleton.** This repository currently contains the monorepo, tooling and
> Docker setup only — no domain module (patients, billing, appointments, …) is scaffolded yet.

## Requirements

Docker and Docker Compose are the only requirements. The entire project — development and
production — runs in containers; Node and pnpm are never installed on the host.

## Development

```bash
cp .env.example .env && docker compose up
```

That is the whole setup. It starts PostgreSQL, the API and the web app:

| Service    | URL                                        |
| ---------- | ------------------------------------------ |
| Web app    | http://localhost:5173                      |
| API        | http://localhost:3000 (health: `/health`)  |
| PostgreSQL | `localhost:5432` (credentials from `.env`) |

The web app's landing page calls the API's `/health` endpoint through the `/api` proxy and
renders the result in Arabic — if it shows the database as connected, the whole stack is wired up.

Hot reload covers `apps/api`, `apps/web` **and** `packages/shared`: editing a shared Zod
schema restarts the API and refreshes the browser.

Useful variations:

```bash
docker compose up --build          # rebuild the dev image (e.g. after changing docker/)
docker compose logs -f api         # follow one service
docker compose down                # stop
docker compose down -v             # stop and drop volumes (database + node_modules)
```

Dependencies live in named volumes, not on the host. After changing a `package.json`,
update the lockfile and let the containers reinstall:

```bash
docker compose run --rm --no-deps api pnpm install
docker compose up
```

### Running commands inside the stack

```bash
docker compose exec api pnpm --filter @clinic/api test
docker compose exec api pnpm --filter @clinic/api db:generate   # generate a migration
docker compose exec api node dist/database/migrate.js           # apply migrations
docker compose exec web pnpm --filter @clinic/web test
```

## Production

```bash
cp .env.example .env                                # then edit: real secrets, CORS_ORIGIN, WEB_PORT=80
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Production images are built from the same repository-root context, contain no sources or
build tooling, and use no bind mounts. The API applies pending Drizzle migrations and only
then starts listening. The web app is served by nginx, which also proxies `/api` to the API
container so the frontend stays same-origin.

```bash
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml down
```

## Repository layout

```
apps/
  api/        NestJS (Fastify adapter) — one Nest module per domain module
  web/        React + Vite — one feature folder per domain module
packages/
  shared/     Zod schemas, shared types, enums, constants — used by both apps
docker/       Dockerfiles, nginx config, dev entrypoints
```

`packages/shared` exists exactly once. Both apps consume it through the pnpm workspace
symlink — in development, in the Docker images and in CI. It is never published and never
copied into an app.

## Working without Docker

Docker is the supported path, but the workspace runs natively too (Node 22 + pnpm 10):

```bash
pnpm install
pnpm build                                  # builds packages/shared first
pnpm --filter @clinic/api start:dev         # needs a reachable DATABASE_URL
pnpm --filter @clinic/web dev
```

Point `DATABASE_URL` at `localhost` instead of the `postgres` service name.

## Checks

```bash
pnpm lint                    # ESLint (flat config, shared by every package)
pnpm exec prettier --check . # formatting
pnpm typecheck               # tsc --noEmit, strict, every package
pnpm test                    # Jest (api) + Vitest (web)
pnpm build                   # all workspaces
```

CI runs exactly these on every pull request, and additionally builds both Docker images.

## Conventions

- **Commits follow [Conventional Commits](https://www.conventionalcommits.org/)**, scoped by
  domain module: `feat(billing): add payment ledger`, `fix(api): scope patients by clinic`,
  `chore(deps): bump drizzle-orm`. Code, comments, commit messages and API contracts are in
  English; UI strings are Arabic and live in i18n files, never in components.
- Money is `numeric(10,2)` in Postgres and a string in TypeScript — never a float.
- Balances and stock quantities are computed from append-only ledger tables, never stored.
- Medical and financial rows are soft-deleted only.
- Secrets never enter the repository: `.env` is gitignored, `.env.example` is the documented
  template and every new variable must be added to it.
