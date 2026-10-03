# CLAUDE.md — Clinic Management System

A web-based clinic management system. The first client is a dental clinic; the system is
**multi-specialty by design**. Never put dental-only logic outside the dental specialty
configuration.

Everything hangs off the **patient record**: appointments, visits, treatments, X-rays, lab orders
and payments attach to the patient and appear in one timeline.

## Roles

`admin` · `doctor` · `technician` · `receptionist`, plus anonymous **public** on the booking page.
One clinic, one role per user. `admin` passes every role check within its own clinic.

**`ROLES.md` is the specification — read it before implementing any endpoint.** Its five global
rules, in short:

1. Every request is scoped to the caller's `clinic_id`, taken from the token and never from the
   body, path or query. Another clinic's row is a 404, never a 403.
2. **Capabilities decide, never a role in code.** Every endpoint is a capability and every data rule
   (medical fields, balances, every patient vs assigned ones, every calendar vs one's own) is a rule
   capability in `RULE`; a clinic grants or withdraws each per role. Capabilities decide which fields
   are serialized, not only which endpoints answer; a field the caller may not read is absent, not
   null. Only `admin` is fixed: it passes every check.
3. Financial and medical mutations always write an audit entry with old and new values.
4. Nothing is hard-deleted. Only `admin` may soft-delete financial records or view deleted rows.
5. Doctors see the records of patients in their clinic (v1); `STRICT_DOCTOR_SCOPE` exists to tighten
   this later.

## Tech stack

- **API** NestJS on Fastify, TypeScript strict
- **Database** Drizzle ORM + PostgreSQL, migrations via `drizzle-kit`
- **Web** React + Vite, RTL-first Arabic, i18n (Arabic default)
- **Shared** pnpm workspaces: `packages/shared` (Zod schemas, types, enums), `packages/ui` (the
  interface system)
- **Validation** Zod everywhere; DTOs are shared schemas via `nestjs-zod`
- **Files** Cloudflare R2 (S3-compatible), presigned URLs, never public
- **Auth** JWT (short access + refresh cookie), role guards
- **Infra** one small VPS. Keep the memory footprint low.

```
apps/api    src/modules/<module>/ — one Nest module per domain, sorted by kind inside
apps/web    src/modules/<module>/ — one folder per domain, sorted by kind inside; src/shared/
            for what several modules use; tests in apps/web/test mirroring src
packages/shared   Zod schemas, types, enums, constants
packages/ui       components, tokens, the theme contract
```

## Modules, in build order

core · patients · billing · appointments · booking · notifications · labs · inventory · reports

**Phase 1** core, patients, billing, internal appointments, roles, audit log.
**Phase 2** public booking, notifications, labs, inventory.
**Phase 3** reports, dashboard, prescriptions, a second specialty chart, expenses.

## Architecture

1. **Multi-clinic, multi-specialty from day one.** Every domain table carries `clinic_id`.
   Specialty behaviour is configuration and data, never a code branch.
2. **Ledgers, not balances.** `charges`, `payments`, `lab_orders`, `lab_payments`,
   `stock_movements` are append-only. A balance and a quantity are `sum()` over them, computed on
   read. A correction is a new reversing row. **Never store an editable balance or quantity.**
3. **Soft delete** for everything medical and financial, plus `created_by`/`updated_by`/
   `created_at`/`updated_at`.
4. **Audit log** on every financial and medical mutation: user, time, entity, old and new value.
   Immutable — no update or delete path. The database enforces it with triggers (migration 0048):
   the audit logs are append-only, a ledger row may change only its reversal and soft-delete
   markers, and no medical or financial row is hard-deleted. Only a superuser setting
   `session_replication_role = replica` (the seed, test clean-up) gets past them.
5. **Charts** use FDI numbering (11–48, 51–85). `chart_marks` links a treatment to a location
   generically per specialty.
6. **Public booking is anonymous.** No patient accounts; the phone number is the identity. Slots are
   computed, never stored.
7. **State machines are code enums**, in `packages/shared`; transitions validated in services.
8. **Every user-facing choice list is data**, in `lookup_options`, scoped per clinic and grouped by
   `list_key`. Adding an option is not a code change. `is_system` is a label, not a lock: every row
   can be renamed, recoloured, reordered, switched off or deleted. Switching off keeps the name
   resolving; deleting takes it and the stored code falls back to itself. Codes are never edited.
   **The exception is a status that drives a state machine** — appointment status, lab order status,
   stock movement direction — which stays an enum.
9. **`AvailabilityService` is the only place that decides whether a minute is bookable.** It
   subtracts, in order: clinic closures, clinic working hours, the doctor's schedule, doctor time
   off, and booked appointments. `closedReason` says which. A closure or absence over booked
   appointments answers 409 with who is in the way; the caller returns with `force` and optionally
   `cancelAppointments`.
10. **Staff and clinic names are bilingual, patient names are not.** `{ ar, en }` through
    `<PersonName>` / `personName()`, never a per-screen ternary. A patient's name is one language.
    Names are stored in parts (patient: first, optional middle, last; staff: first and last per
    language) and the API writes the full name beside them — `fullName` / `name` in every response,
    `firstName` / `lastName` where a screen is short of room. The web never splits a full name.
    Printed documents use the clinic's document language.
11. **Money is whole numbers in the interface, and a symbol.** `wholeMoneySchema` gates every write;
    money inputs refuse a decimal separator; displays format with zero decimals. Storage stays
    `numeric(10,2)` and read schemas stay `moneySchema`. The currency is its symbol from
    `CURRENCY_SYMBOLS`, never a code or a name.
12. **Translations are editable per clinic.** `translation_overrides` stores only what an admin
    changed; the locale files remain the default, so improved wording still reaches untouched keys
    and a reset is a row delete.

## Backend

- `controller` (thin) → `service` (logic) → Drizzle. No business logic in controllers or schemas.
- **`src/modules/<module>/` is sorted by kind:** `<module>.module.ts` at its root, then `controllers/`,
  `services/` (every `@Injectable`), `dto/<name>.dto.ts`, `lib/<name>.ts` (row types, mappers, SQL
  fragments, pure functions) and `constants.ts` (UPPER_CASE values only). A file holds one kind: a
  service file is its class and nothing else. A constant built from a module's own helpers lives with
  them in `lib/`, never in `constants.ts`, so the two never import each other.
- **Modules compose through services, module files and dto only.** Another module's `lib/` and
  `constants.ts` are private to it; what two modules need lives in `src/common/` (`lib/`,
  `constants/` — audit entity names, Postgres error codes —, `types/`). ESLint enforces it.
- DTOs are shared Zod schemas. Never duplicate validation.
- `JwtAuthGuard` global; `@Roles(...)` per endpoint; object-level checks inside services.
- **Every route is rate limited** by the global `RequestThrottlerGuard` (per user, or per IP when
  signed out); a public or costly route adds a tighter `@Throttle`. The client IP is trusted only
  past our own proxies (`TRUST_PROXY`). Sign-in locks an identifier for 15 minutes after five
  failures; a public route that sends a message caps sends per phone.
- **The assistant never changes data unasked:** every action tool is tier `confirm` or stricter,
  so the user approves each change on its card. A linked id (a visit, a procedure, a work type) is
  checked to belong to the same patient, clinic or lab before it is stored.
- Every list endpoint paginates, filters by query param, and is clinic-scoped automatically.
- **Newest first by default** — every list, table and attachment list. A sort picker may offer
  other orders; its default is newest. Exceptions carry meaning: a calendar or queue by time, the
  waiting list by priority, an admin-ordered list by `sortOrder`, batches by expiry.
- Money is `numeric(10,2)`, handled as strings. **Never float.**
- Errors are `{ statusCode, message, error }`; Arabic wording is resolved on the front end by code.
- Every schema change is a committed `drizzle-kit generate` migration. Never edit an applied one.

## Frontend

- Functional components, hooks, TanStack Query.
- **`src/modules/<module>/` holds one domain, sorted by kind:** `pages/` (a screen or tab),
  `components/`, `hooks/` (one hook per file, `use-….ts`), `lib/` (plain helpers), and `api.ts`,
  `queries.ts` (TanStack hooks and their keys), `constants.ts`. What several
  modules use lives in `src/shared/` with the same kinds (`components/`, `hooks/`, `lib/`,
  `constants/`, `providers/`, `api/`, `queries/`, `permissions/`). `app/` is the shell (router,
  providers, `app/layout/`), `i18n/` the locales, `booking/` the separate public bundle. A file
  holds one kind: no hook, constant or helper exported from a component. No `index.ts` barrels;
  import the exact file. The API's `src/modules/<module>/` mirrors the name.
- **Layers only point down:** `app/` → `modules/` → `shared/`. A module may render another
  module's `pages/` and `components/`; its `lib/`, `hooks/`, `api.ts`, `queries.ts` and
  `constants.ts` are private. A helper, key or date window two modules need is written once in
  `shared/`, never copied. ESLint enforces it.
- **One date and time format.** `shared/lib/format.ts` alone turns an instant into text, in the
  clinic's time zone: `formatDate` "9 May 2026", `formatTime` "10:30 AM", `formatDateTime`
  "9 May 2026 · 10:30 AM", `formatPeriod`. Never `toLocaleString` or a hand-joined date and time.
- **RTL by default.** Gregorian dates, Arabic through i18n. `check:i18n` fails on an Arabic literal
  in a component and on a key missing from either locale.
- Dropdowns read the clinic's lists through `useLookupOptions` / `useLookupLabels`, never a constant.
- Role-aware UI is cosmetic; the API is the boundary. Never link to a page the reader would be
  bounced off — check the helper the route guard uses.
- **A view somebody can reach is a view somebody can link to.** Tabs and filters live in the URL,
  never `useState`. A retired route redirects, it does not disappear.
- **Navigation is one table.** `shared/lib/navigation.ts` gives each section the capabilities that
  open it (`PAGE_CAPABILITIES`); the sidebar and the route guards read the same table, so a grant on
  the Permissions page adds the section and its route at once. No screen tests a role. An inner page
  (a patient, a lab, an item) takes the back link above its title from the same file, `backTarget`:
  one step back in the app, or its parent list when opened directly — the installed app has no
  browser Back.
- The top bar reads search-first, actions-last, in logical properties.

### The interface system

`packages/ui`, imported as `@clinic/ui`. One library, many branded copies, so nothing inside names a
clinic or a colour. `base.css` declares every token with a neutral default; a product's
`theme.css`/`theme.ts` supplies values — **values, never new token names**. Change a component
through its `className` or a `data-part`, never a fork.

- **Content widths are tokens:** `--form-max` for a form's columns and `--field-max` for one field
  alone in a wide container (a textarea excepted). No form field or text block may stretch beyond
  its layout token on wide viewports.
- **One confirmation:** every destructive action asks through `ConfirmDialog` / `useConfirm`, never
  `window.confirm`; the title names the thing, the body says what goes with it. It is an
  `alertdialog` described by its consequences: Enter confirms, Tab cycles Cancel and Confirm, Esc
  closes.
- **Two control heights and no third:** `--control-h` for a target (field, button, chip),
  `--control-h-sm` for a compact row (tab, segment, table-row button, badge). A third is a token
  change.
- **Type comes from a token.** `pnpm lint:type` fails on any font size or line height written at a
  call site. The scale is in `base.css` against a 16px root; nothing carrying content is under 12px.
- **One of each primitive.** One pill, one menu, one field box; the rest are variants. `fieldShell()`
  draws every input, select and picker trigger.
- **A dialog focuses nothing when it opens**, and a picker opens on click, Enter, Space or
  ArrowDown — never on focus.
- **Everything works from the keyboard.** A clickable row or card is a Tab stop that opens on
  Enter or Space. Tabs and segmented controls are one Tab stop moved by the arrow keys (mirrored in
  RTL), Home and End. A closing drawer or dialog returns focus to what opened it. A calendar opens
  on its selected day. The shell starts with a skip-to-content link. An unavailable action is
  `aria-disabled`, never `disabled`: it stays a Tab stop, reads as unavailable, and ignores presses.
- `Select` is Radix's, not the platform's: a native `<select>` did nothing on iOS Safari and cannot
  be tested off the device.
- **Use the shared control:** `<Money>`, `<MoneyInput>`, `<PersonName>`, `<PhoneLink>`,
  `<EmailLink>`, `<Img>` (always sized), `<Avatar>`. Never a raw `<img>`, never a phone number as
  inert text.
- **There is no bundled logo.** `Logo` draws the clinic's own upload, or a generated mark.
- **Every component is addressable:** one `data-testid` naming the whole subtree, inner parts
  derived from `data-part`. A row carries its own id. Nothing selects on a testid in CSS.
- Colours are named in `packages/ui/src/styles/base.css` and a product's `theme.css`/`theme.ts`.
  `lint:hex` fails on a literal anywhere else.

## Files & images

Upload through presigned R2 URLs; store the key and metadata, serve short-lived signed URLs. A
receptionist never receives an attachment URL. **Staff have a photo, patients do not.**

## Testing

- **API** Jest against a real Postgres. Required: balance computation, slot availability and
  conflicts, permission boundaries per role, lab-order transitions, audit writes.
- **Web** Vitest under `apps/web/test` (`pnpm test`: jsdom, plus a node lane for the dev proxy), and
  only two kinds of test:
  - **Security**: every role's sidebar asserted **as a whole list** (the failure that matters is an
    entry appearing for somebody it was never meant for), each route guard per role, each retired
    address landing on its replacement, fields a role must not see, and the session's tokens.
  - **Logic** with no rendering: a module's `lib/`, `hooks/` and `queries.ts`, `shared/lib/`, `i18n/`.
  No page, component, layout or browser-mode tests.
- **Direction and spacing are still verified by a person on the sandbox.** A pull request that
  changes what a screen looks like carries screenshots in its description, in Arabic RTL, at the
  widths it touches. Screenshots are never committed.

## Versioning & deploy

The version is `<major>.<minor>` from the root `package.json` plus the commit count, resolved at
deploy and never stored. `APP_VERSION` reaches the API as an environment variable and the web as a
build arg; without them the answer is `0.0.0-dev`. The API serves `/version`; the web shows the
API's beside its own only when they differ.

CI and the sandbox deploy run only when started by hand (`workflow_dispatch`); nothing runs on a
push or a pull request.

## Never

- store or expose an editable balance or quantity
- hard-delete a medical or financial row
- use a float for money
- skip the audit interceptor on a financial or medical mutation
- return medical fields to a caller without `patients.clinical`
- decide anything by comparing a role in code; add a capability or a `RULE` instead
- put dental logic in core, billing or appointments
- hardcode a user-facing choice list, a colour, a font size or a control height
- decide whether a minute is bookable anywhere but `AvailabilityService`
- put a tab or filter in `useState`, or drop a route without redirecting it
- write a user-facing string in a component
- commit a secret or a screenshot

## Language & commits

Code, comments, commits and the API are English. UI strings are Arabic through i18n. Conventional
commits (`feat(billing): ...`).

## Comments

**No comments.** Code explains itself through naming; rationale belongs in the pull request.

The only exception is a rule that would be dangerous to "tidy" away — a security invariant such as a
request that must not carry the bearer token. One or two lines, and rare. Tool directives
(`eslint-disable`, `@ts-expect-error`, `// i18n-allow:`, `// check-type-disable-next-line`) are not
comments and stay. An intentionally ignored failure is an empty `catch {}`.
