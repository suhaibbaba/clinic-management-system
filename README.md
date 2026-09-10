# Clinic Management System

Multi-clinic, multi-specialty clinic management system. Arabic (RTL) web UI, NestJS API,
PostgreSQL. See [CLAUDE.md](./CLAUDE.md) for architecture rules and [ROLES.md](./ROLES.md)
for the authorization spec.

> **Status: core, patients, billing, appointments, public booking and notifications.**
> Clinics, specialties, users/roles, doctors, auth and the audit log are implemented, as is
> the patient record — medical history, visits, procedures and chart marks, treatment plans,
> X-rays, prescriptions and the merged timeline — the money (charges, payments, statements,
> printable receipts and overdue balances) and the calendar, with conflicts prevented by a
> database constraint rather than a check. Arabic RTL screens for all of it. The newest layer
> is backend-only for now: anonymous patients can book through `/public/booking/:clinicSlug`
> and confirm by OTP, and every message goes out through a `NotificationsService` whose
> default provider writes to `notifications_log` and sends nothing. The public booking page
> itself is next.

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
| `GET`    | `/patients?hasBalance=true`          | every role but technician (filter ignored)   |
| `GET`    | `/dashboard/summary`                 | every role; the figures differ by role       |

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

The sidebar is five sections and a collapsed settings group; the account and sign-out live in
the menu on the avatar, not in the nav.

| Screen       | Route                    | Who                                                     |
| ------------ | ------------------------ | ------------------------------------------------------- |
| Login        | `/login`                 | anyone                                                  |
| Dashboard    | `/dashboard`             | every role — where signing in lands                     |
| Patients     | `/patients`              | admin, doctor, receptionist                             |
| Patient file | `/patients/:id`          | admin, doctor; a receptionist sees the account tab only |
| Appointments | `/appointments`          | admin, doctor, receptionist                             |
| Labs         | `/labs`                  | admin, doctor, technician                               |
| Inventory    | `/inventory`             | admin, technician                                       |
| Settings     | `/clinic`, `/doctors`, … | admin                                                   |
| My account   | `/profile`               | every role                                              |

Four sections are two panels each, selected by a query parameter so every panel keeps an
address somebody can link to or bookmark:

| Section         | Tabs                                              |
| --------------- | ------------------------------------------------- |
| `/appointments` | `?status=` — the calendar, `pending`, `confirmed` |
| `/labs`         | `?tab=` — `orders` (the board), `directory`       |
| `/inventory`    | `?tab=` — `stock`, `suppliers`                    |
| `/patients`     | `?filter=balance` — only the patients who owe     |

The addresses those panels used to have (`/appointments/pending`, `/lab-orders`, `/suppliers`,
`/billing/overdue`) still resolve: each redirects to the tab or filter that replaced it, so a
bookmark lands where the page went rather than on a dashboard with a shrug.

Screenshots of each one live in [`docs/screenshots/`](./docs/screenshots):
[the dashboard](./docs/screenshots/nav-dashboard-admin.png),
[the settings group open](./docs/screenshots/nav-settings-open.png),
[the booking queue as a tab](./docs/screenshots/nav-appointments-pending.png),
[the labs directory as a tab](./docs/screenshots/nav-labs-directory.png),
[a technician's dashboard](./docs/screenshots/nav-dashboard-technician.png) — one card, no money —
and [the nav on a phone](./docs/screenshots/nav-drawer-phone.png).

The patients list is search-first: one box over name, phone and file number, searched on the
server and debounced. Its owing filter is the server's too — a balance is an aggregate, not a
column, so narrowing the page in hand would answer "which of these ten owe" while looking like
it answered "who owes". A receptionist gets the `PatientPublicView` columns — the API hands
them that shape, so the clinical columns are absent rather than hidden.

### Dashboard

One request, `GET /dashboard/summary`, carries all four things the landing page draws: today's
appointment count, the day's schedule, the online bookings nobody has answered, and what the
clinic is owed past its overdue window. Each card is a link to the rows behind it.

Nothing on it is a new source of truth — the schedule is the calendar's own query, the queue is
reception's filtered read, the overdue figure is the overdue service's aggregate — so a card
can never disagree with the page it links to. Which figures a caller gets is decided in the
response rather than on the screen: a technician's carries no money and a doctor's no booking
queue, matching their ROLES.md rows.

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
`Select`, `SearchField`, `Table` (with `Pagination`), `Modal`, `Drawer`,
`ToastProvider`/`useToast`, `FormField`, `PageHeader`, `EmptyState`, `Badge`, `Switch`,
`Card`, `StatCard`, `SegmentedControl`, `EntityCard`, `ProgressBar`, `Avatar` and `Icon`,
plus a shared `ScheduleEditor`. They are RTL-correct by construction: logical properties
(`ms-*`, `text-start`, `border-e`) rather than left/right, so nothing needs an RTL override.

Icons come from lucide, behind a wrapper in `icon.tsx` that fixes the size (18px, or 20px for
a lone icon) and the stroke (1.75). The wrapper is the point: lucide takes both per call site,
which is exactly how a set drifts into one screen at 16/2 and the next at 20/1.5. Names go
through an `IconName` union rather than importing lucide directly, so the vocabulary is a list
you can read and swapping the set again is one file. The one hand-drawn glyph is the tooth,
which lucide does not have.

### The design system

`apps/web/src/theme.css` holds all of it — colour, geometry, elevation and type. A flat, very
light cool ground, white cards drawn with a hairline, the clinic's own blue for everything
actionable, a green that means settled and a red for money owed:

|                    |                                  |
| ------------------ | -------------------------------- |
| ground `#F4F7FA`   | card `#FFFFFF`                   |
| ink `#1B2432`      | secondary `#64748B`              |
| hairline `#E3E9F0` | blue `#316C9C` (hover `#295B84`) |
| green `#4EC191`    | red `#E5484D`                    |

The scales around those are one perceptual ramp per hue with the brand pinned at `primary-600`
and `success-500`, so a tint of the blue carries the same weight as a tint of the red beside it.
The neutral is mixed towards the blue rather than a pure grey, so the ground and the hairlines
belong to the same family as the brand.

**One accent.** If it is blue it is clickable — buttons, links, the active nav row, focus rings.
Green is a settled balance, a confirmed appointment, a finished plan; red is an outstanding
balance and a destructive action. Nothing else on a page fills with a colour. The one exception is
the tooth chart, and deliberately: nine conditions cannot be encoded in one hue, and a tooth fill
is data rather than an action.

**Two colours have an AA-safe twin.** `#7B8899` is 3.61 on white and `#4EC191` is 2.24 — both under
the 4.5 a 13px table header or a "paid" label needs. So `ink-subtle` is `#7B8899` exactly, for
placeholders and decoration, and `ink-muted` (`#64748B`) carries secondary text that has to be
_read_; likewise `success-500` is `#4EC191` for fills and dots, and `success-700` is what the word
beside them is written in. Using the named value everywhere would put a clinic's table headers
below the legibility floor.

**A card is defined by its edge, not by its shadow.** `shadow-card` is a hairline ring plus almost
no blur, drawn as a spread shadow rather than a border so a card does not change size when it
gains one and a rounded panel's outline follows its own corner. Elevation is spent only on things
that genuinely float — a menu, a dialog, a toast — and even those carry the same hairline.

Geometry: cards `12px`, panels `10px`, controls `8px`, and the pill kept for the things that are
genuinely lozenges — a badge, an avatar, a progress track. Buttons and fields are `36px` on a
laptop inside a `44px` touch target below `lg`.

Type is Inter for Latin and IBM Plex Sans Arabic for Arabic, both bundled and neither hotlinked.
Inter leads the stack, so Arabic falls through to Plex with no per-element font switching. The
scale is what a record wants rather than what a brand page does: page title 20px/600, card title
16px/600, body 14px, table headers and captions 13px, a stat card's label 12px and its figure
24px. Tracking is neutral through the body and `-0.01em` on a title. The field floor stays 16px —
that is the iOS zoom rule, not a matter of taste, and `field-size.test.ts` fails the build if a
field drops under it.

The sidebar and the page's bar are plain white with a hairline where they meet the content. An
earlier revision frosted them and let the page scroll through, which put a second edge behind
every card once cards were drawn as outlines — and where the effect did not apply, the sticky bar
had no background at all and the breadcrumb read over a phone number scrolling underneath it.

The sidebar's destinations are captioned by what they are for, each caption a 12px muted line with
a chevron that folds its section away; the active row is a solid blue pill. Which row that is
comes from `activeNavItem`, the longest destination that prefixes the path, so `/clinic/lists`
lights the lists row and not the clinic row above it — and the breadcrumb reads the same helper.

The focus ring is declared once, globally, rather than per component: fourteen components each
carrying their own outline utility is fourteen chances for one to be 1px, a different blue, or
missing.

### Mobile

Below `md` the sidebar becomes a real drawer (`NavDrawer`, over Radix Dialog): it slides in from the
inline start — the right in Arabic — over a scrim, traps focus, and closes on Escape, on the scrim
and on navigating. It does **not** simply unhide the rail and push the page down, which is what it
did first and which meant scrolling past seven nav rows to get back to the content.

Page CTAs go full width, toolbars stack, KPI cards go two-up, and
table rows become label/value cards with the label at the reading start and the value at the end.

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
