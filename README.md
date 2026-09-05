# Clinic Management System

Multi-clinic, multi-specialty clinic management system. Arabic (RTL) web UI, NestJS API,
PostgreSQL. See [CLAUDE.md](./CLAUDE.md) for architecture rules and [ROLES.md](./ROLES.md)
for the authorization spec.

> **Status: core, patients and billing.** Clinics, specialties, users/roles, doctors, auth and
> the audit log are implemented, as is the patient record — medical history, visits, procedures
> and chart marks, treatment plans, X-rays, prescriptions and the merged timeline — and the
> money: charges, payments, statements, printable receipts and overdue balances. Arabic RTL
> screens for all of it. Appointments are next; the patient file's prescriptions and timeline
> tabs are placeholders until they land.

## Requirements

Docker and Docker Compose are the only requirements. The entire project — development and
production — runs in containers; Node and pnpm are never installed on the host.

## Development

```bash
cp .env.example .env && docker compose up
```

That is the whole setup. It starts PostgreSQL, MinIO, the API and the web app:

| Service       | URL                                        |
| ------------- | ------------------------------------------ |
| Web app       | http://localhost:5173                      |
| API           | http://localhost:3000 (health: `/health`)  |
| PostgreSQL    | `localhost:5432` (credentials from `.env`) |
| MinIO (S3)    | `localhost:9000` (credentials from `.env`) |
| MinIO console | http://localhost:9001                      |

MinIO stands in for Cloudflare R2, so X-rays and documents work locally with no R2
account: the bucket is created on first boot and the API talks to it through the same
presigned-URL flow it uses in production. Point `STORAGE_*` at R2 to deploy.

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

### Seeding

```bash
docker compose exec api pnpm seed
```

Creates one clinic, the dental specialty, one account per role, a dental procedure
catalog and ten patients with medical histories, visits, procedures on FDI teeth and a
treatment plan — then prints the credentials. It is idempotent, so re-running it is safe.
The accounts and the password are documented in `.env.example`.

Sign in with either the phone or the email:

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"identifier":"admin@clinic.local","password":"ChangeMe123!"}'
```

### Running commands inside the stack

```bash
docker compose exec api pnpm --filter @clinic/api test
docker compose exec api pnpm --filter @clinic/api db:generate   # generate a migration
docker compose exec api node dist/database/migrate.js           # apply migrations
docker compose exec api pnpm seed
docker compose exec web pnpm --filter @clinic/web test
```

## API

All endpoints require a bearer access token except those marked public. Every request is
scoped to the caller's clinic, taken from the token — no endpoint accepts a `clinic_id`.

| Method   | Path                    | Roles                                 |
| -------- | ----------------------- | ------------------------------------- |
| `GET`    | `/health`               | public                                |
| `POST`   | `/auth/login`           | public                                |
| `POST`   | `/auth/refresh`         | public                                |
| `POST`   | `/auth/logout`          | public                                |
| `GET`    | `/me`                   | any                                   |
| `POST`   | `/me/change-password`   | any                                   |
| `GET`    | `/clinic`               | any                                   |
| `PATCH`  | `/clinic`               | admin                                 |
| `GET`    | `/doctors`              | any                                   |
| `GET`    | `/doctors/:id`          | any                                   |
| `POST`   | `/doctors`              | admin                                 |
| `PATCH`  | `/doctors/:id`          | admin                                 |
| `PATCH`  | `/doctors/:id/schedule` | admin, or the doctor who owns the row |
| `DELETE` | `/doctors/:id`          | admin (soft delete)                   |
| `GET`    | `/users`                | admin                                 |
| `GET`    | `/users/:id`            | admin                                 |
| `POST`   | `/users`                | admin                                 |
| `PATCH`  | `/users/:id`            | admin                                 |
| `DELETE` | `/users/:id`            | admin (soft delete)                   |
| `GET`    | `/audit-log`            | admin                                 |

The audit log has no write endpoint by design — it is immutable.

### Patients

Every clinical endpoint is admin + doctor unless the table says otherwise. A receptionist
and a technician receive `PatientPublicView`; a receptionist never receives attachment
data of any kind (ROLES.md field rules).

| Method   | Path                                              | Roles                                |
| -------- | ------------------------------------------------- | ------------------------------------ |
| `GET`    | `/patients`                                       | any (search: name, phone, file no.)  |
| `GET`    | `/patients/:id`                                   | any (view chosen by role)            |
| `POST`   | `/patients`                                       | admin, doctor, receptionist          |
| `PATCH`  | `/patients/:id`                                   | admin, doctor, receptionist          |
| `DELETE` | `/patients/:id`                                   | admin (soft delete)                  |
| `GET`    | `/patients/:patientId/medical-history`            | admin, doctor                        |
| `PATCH`  | `/patients/:patientId/medical-history`            | admin, doctor                        |
| `GET`    | `/patients/:patientId/allergy-flags`              | admin, doctor, technician            |
| `GET`    | `/patients/:patientId/teeth/:fdi`                 | admin, doctor                        |
| `GET`    | `/patients/:patientId/timeline`                   | admin, doctor, receptionist          |
| `GET`    | `/patients/:patientId/attachments`                | admin, doctor                        |
| `POST`   | `/patients/:patientId/attachments/presign-upload` | admin, doctor                        |
| `POST`   | `/patients/:patientId/attachments/confirm`        | admin, doctor                        |
| `GET`    | `/attachments/:id`                                | admin, doctor (signed URL)           |
| `DELETE` | `/attachments/:id`                                | admin (soft delete)                  |
| `GET`    | `/visits`, `/visits/:id`                          | admin, doctor                        |
| `POST`   | `/visits`                                         | admin, doctor                        |
| `PATCH`  | `/visits/:id`                                     | admin, doctor                        |
| `DELETE` | `/visits/:id`                                     | admin (soft delete)                  |
| `GET`    | `/performed-procedures`                           | admin, doctor, technician (lab-only) |
| `GET`    | `/performed-procedures/:id`                       | admin, doctor                        |
| `POST`   | `/performed-procedures`                           | admin, doctor                        |
| `PATCH`  | `/performed-procedures/:id`                       | admin, doctor                        |
| `DELETE` | `/performed-procedures/:id`                       | admin (soft delete)                  |
| `GET`    | `/treatment-plans`, `/treatment-plans/:id`        | admin, doctor                        |
| `POST`   | `/treatment-plans`                                | admin, doctor                        |
| `PATCH`  | `/treatment-plans/:id`                            | admin, doctor                        |
| `DELETE` | `/treatment-plans/:id`                            | admin (soft delete)                  |
| `POST`   | `/treatment-plans/:id/items`                      | admin, doctor                        |
| `PATCH`  | `/plan-items/:id`                                 | admin, doctor                        |
| `DELETE` | `/plan-items/:id`                                 | admin (soft delete)                  |
| `POST`   | `/plan-items/:id/convert`                         | admin, doctor                        |
| `GET`    | `/prescriptions`, `/prescriptions/:id`            | admin, doctor                        |
| `POST`   | `/prescriptions`                                  | admin, doctor                        |
| `PATCH`  | `/prescriptions/:id`                              | admin, doctor                        |
| `DELETE` | `/prescriptions/:id`                              | admin (soft delete)                  |
| `GET`    | `/procedure-catalog`, `/procedure-catalog/:id`    | any (receptionist: names + prices)   |
| `POST`   | `/procedure-catalog`                              | admin                                |
| `PATCH`  | `/procedure-catalog/:id`                          | admin                                |
| `DELETE` | `/procedure-catalog/:id`                          | admin (soft delete)                  |

Uploads are two steps so bytes never pass through the API: `presign-upload` returns a
short-lived PUT URL under a key the API builds, the client uploads straight to storage,
then `confirm` records the metadata — reading size and content type back from the bucket
rather than trusting the request. Reads return a signed GET that expires with
`STORAGE_DOWNLOAD_URL_TTL_SECONDS`; the object key never leaves the API.

### Billing

Money is a ledger, never a field. `charges` and `payments` are append-only, and every balance
is `sum(charges) − sum(payments)` computed by a SQL aggregate on read — there is no stored
balance anywhere, and no endpoint accepts one.

A charge is written in the **same transaction** as the performed procedure that causes it, so a
procedure and its charge can never disagree. Re-pricing or removing a procedure does not touch
the original charge: it writes a reversing entry (the negative of it, pointing back through
`reverses_id`) and, where there is still something to bill, a new charge beside it. A payment
is corrected the same way, by an admin, and nothing is ever updated or deleted.

| Method   | Path                                 | Roles                                        |
| -------- | ------------------------------------ | -------------------------------------------- |
| `GET`    | `/patients/:patientId/balance`       | admin, doctor, receptionist                  |
| `GET`    | `/patients/:patientId/statement`     | admin, doctor, receptionist                  |
| `GET`    | `/patients/:patientId/statement.pdf` | admin, doctor, receptionist                  |
| `GET`    | `/payments`, `/payments/:id`         | admin, doctor, receptionist                  |
| `GET`    | `/payments/:id/receipt`              | admin, doctor, receptionist (PDF)            |
| `POST`   | `/payments`                          | admin, receptionist                          |
| `POST`   | `/payments/:id/reverse`              | admin                                        |
| `DELETE` | `/payments/:id`                      | admin (writes the reversal, deletes nothing) |
| `GET`    | `/billing/overdue`                   | admin, receptionist                          |

A technician sees none of it: ROLES.md lists `balance` on `PatientPublicView`, but its field
rules forbid financial patient data in a technician response, and the narrower rule wins — the
field is absent from their patient payload rather than sent as null.

Receipt numbers are per clinic and gapless. They come from a `clinic_counters` row bumped
inside the payment's own transaction, not a Postgres sequence: `nextval` does not roll back, so
a failed payment would burn a number out of a document series the clinic has to account for.

Statements and receipts are PDFs rendered by pdf-lib with Amiri embedded — no headless browser,
because the API is meant to run beside Postgres on one small VPS. Arabic is shaped in-repo into
Unicode presentation forms and ordered by `bidi-js`, and technical values (a phone number, a
date range) are drawn as explicit left-to-right islands. See
[`docs/screenshots/billing-statement-pdf.png`](./docs/screenshots/billing-statement-pdf.png).

## Web app

Sign in at http://localhost:5173 with any seeded account. Screens, all Arabic and RTL:

| Screen           | Route              | Who                                                               |
| ---------------- | ------------------ | ----------------------------------------------------------------- |
| Login            | `/login`           | anyone                                                            |
| Doctors          | `/doctors`         | every role reads; admin writes; a doctor edits their own schedule |
| Clinic settings  | `/clinic`          | every role reads; admin edits                                     |
| Users            | `/users`           | admin                                                             |
| Audit log        | `/audit-log`       | admin                                                             |
| My account       | `/profile`         | every role                                                        |
| Patients         | `/patients`        | every role; the columns shown depend on the role                  |
| Patient file     | `/patients/:id`    | admin, doctor; a receptionist sees the account tab only           |
| Overdue balances | `/billing/overdue` | admin and receptionist                                            |

Screenshots of each one live in [`docs/screenshots/`](./docs/screenshots).

The patients list is search-first: one box over name, phone and file number, searched on the
server and debounced. A receptionist and a technician get the `PatientPublicView` columns — the
API hands them that shape, so the clinical columns are absent rather than hidden.

### Tooth chart

`/patients/:id` opens on an interactive FDI chart — 32 permanent teeth, 20 deciduous behind a
toggle — drawn as one SVG with no charting library. A tooth's colour is **derived** from its
procedures on every render, never stored: the procedure's status decides while work is planned
or under way, and the catalog item's `chart_outcome` decides once it is done.

Every tooth is a real button: arrow keys walk the arches, up and down cross between them,
Enter opens the panel, and each tooth's accessible name states its condition in words — colour
is never the only signal. Selecting a tooth opens a drawer with that tooth's history, a
five-zone surface picker, and (for admin and doctor) prices and X-rays.

The chart is pinned left-to-right inside the RTL page. It is anatomy drawn from the
clinician's point of view, with the patient's right on the viewer's left; mirroring it with the
page would put the wrong side of the mouth on the wrong side of the screen.

### Patient file tabs

| Tab                              | What it does                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tooth chart                      | The interactive FDI chart described above.                                                                                                             |
| Visits                           | One card per encounter — complaint, examination, diagnosis — with the procedures carried out during it listed inside and editable there.               |
| Treatment plans                  | Ordered items with a quoted total, per-item statuses, one-way conversion into a performed procedure, and a printable quote on the clinic's letterhead. |
| Imaging                          | Grid of X-rays and documents. Uploads go presign → straight to storage → confirm; each thumbnail asks for its own short-lived signed URL.              |
| Prescriptions, timeline, billing | Placeholders until their modules land.                                                                                                                 |

Recording a procedure uses one form wherever it is done — from a tooth on the chart, or from a
visit. What differs is the context the caller already knows (a tooth, a visit, or neither),
which is passed in rather than asked for again.

The printable quote is the same component that is on screen, hidden by print CSS until the
browser asks for print. One source of truth means the printed sheet cannot drift from the one
the patient was shown.

The access token is held in memory only and the refresh token in an httpOnly cookie, so a
reload silently re-authenticates and no script can read either. A 401 triggers one refresh and
a replay of the original request; if that fails the app returns to the login screen.

Sidebar entries and routes are filtered by role, which is presentation only — the API is the
boundary, and every screen assumes it can be refused.

### Base components

`apps/web/src/components/ui` holds the pieces every later feature reuses: `Button`, `Input`,
`Select`, `Table` (with `Pagination`), `Modal`, `ToastProvider`/`useToast`, `FormField`,
`PageHeader`, `EmptyState`, `Badge` and `Switch`, plus a shared `ScheduleEditor`. They are
RTL-correct by construction: logical properties (`ms-*`, `text-start`, `border-e`) rather than
left/right, so nothing needs an RTL override.

### Theme and design language

Every colour in the web app comes from `apps/web/src/theme.css`. It is the single source of
truth: components use token utilities (`bg-surface`, `text-ink`, `border-line`,
`text-primary-700`) and never a raw hex, an `rgb()`, a stock Tailwind palette class or an
inline `style` colour. `src/theme.test.ts` enforces that across the whole source tree, so a
stray `#316C9C` fails the suite rather than quietly forking the palette.

The scales are derived from the logo, not picked by eye: brand blue `#316C9C` and brand green
`#4EC191` are converted to OKLCH, and each 50–900 step is generated on one shared perceptual
lightness ramp, then gamut-mapped back into sRGB by reducing chroma along the hue line. All
five families — `primary`, `success`, `danger`, `warning`, `neutral` — therefore carry equal
visual weight at the same step, and `600`/`700` pass WCAG AA on white for text and buttons.

Green is a **success and accent** colour only — active indicators, positive balances, one
tooth state — never a second primary. Semantic aliases (`surface`, `canvas`, `sunken`, `ink`,
`ink-muted`, `line`, …) sit on top of the scales so a component states its intent rather than
a shade, and dark mode re-points those aliases instead of touching components.

The tooth chart's state colours are part of the same system: each state maps to a scale step,
and every fill/ink pair was checked for AA contrast in both light and dark mode before it was
written down.

The logo is one file, `apps/web/src/assets/logo.svg`, imported by `components/brand/logo.tsx`
and used at three sizes: the login page, the sidebar header and the print letterhead on
receipts and printable plans. Replacing the brand mark is `cp your-logo.svg
apps/web/src/assets/logo.svg` — no code change. The favicon (`apps/web/public/favicon.svg`)
is a separate square lockup, since a wide logo is unreadable at 16px.

### Storybook

```bash
pnpm --filter @clinic/web storybook          # dev, http://localhost:6006
pnpm --filter @clinic/web build-storybook    # static build, also run in CI
```

Storybook is the catalogue for the design language: the full palette with live hex values and
contrast ratios, the semantic tokens, the tooth-chart states, and every base component in both
RTL and LTR via the direction toolbar. The palette stories read the tokens back out of the
stylesheet at runtime, so the catalogue is generated from `theme.css` and cannot drift from
it. `addon-a11y` runs in `error` mode, so a contrast or ARIA regression fails the story.

It is a devDependency of `apps/web` only — it is never installed into an image and adds
nothing to the production bundle or the VPS's memory footprint.

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

## Sandbox

A deployed sandbox tracks `main` at
<https://clinic-sandbox.organza-moda.com>. Pushing to `main` connects to the VPS over SSH,
fast-forwards its checkout of this repository to `origin/main`, rebuilds both images there
with `docker-compose.sandbox.yml`, and fails the run unless `/api/health` reports healthy
afterwards. No registry is involved — the images are built and run on the same machine.

It runs on a shared VPS behind a host-level nginx, so the stack itself carries no reverse
proxy and no TLS and publishes every port to `127.0.0.1` only. Server prerequisites, the
nginx blocks, the required GitHub secrets and how to restore a backup are in
[DEPLOY.md](./DEPLOY.md); the environment template is
[`.env.sandbox.example`](./.env.sandbox.example).

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
pnpm --filter @clinic/api dev               # needs a reachable DATABASE_URL
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

The API tests run against a real PostgreSQL rather than mocks, so clinic scoping, the
audit writes and the auth flow are exercised for real. They need `DATABASE_URL`, which
the stack already provides:

```bash
docker compose exec api pnpm --filter @clinic/api test
```

CI runs exactly these on every pull request, and additionally builds Storybook and both
Docker images.

## Conventions

- **Imports use a per-package alias, never a relative path.** `@api/…` in `apps/api`,
  `@web/…` in `apps/web`, `@shared/…` in `packages/shared`, and `@clinic/shared` for the
  shared package itself. ESLint fails the build on a relative import, so a file can move
  without rewriting the imports around it. The aliases are compiled away: `tsc-alias`
  rewrites the emitted JavaScript and declarations to relative paths, so nothing resolves
  aliases at runtime and the production image needs no loader or extra dependency.
- **Commits follow [Conventional Commits](https://www.conventionalcommits.org/)**, scoped by
  domain module: `feat(billing): add payment ledger`, `fix(api): scope patients by clinic`,
  `chore(deps): bump drizzle-orm`. Code, comments, commit messages and API contracts are in
  English; UI strings are Arabic and live in i18n files, never in components.
- Money is `numeric(10,2)` in Postgres and a string in TypeScript — never a float.
- Balances and stock quantities are computed from append-only ledger tables, never stored.
- Medical and financial rows are soft-deleted only.
- Secrets never enter the repository: `.env` is gitignored, `.env.example` is the documented
  template and every new variable must be added to it.
