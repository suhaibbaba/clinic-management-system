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
2. Role decides **which fields are serialized**, not only which endpoints answer. A field a role may
   not read is absent, not null.
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
apps/api    one Nest module per domain module
apps/web    one feature folder per domain module, tests in apps/web/test
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
   Immutable — no update or delete path.
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
    `<PersonName>` / `personName()`, never a per-screen ternary. A patient's name is one field.
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
- DTOs are shared Zod schemas. Never duplicate validation.
- `JwtAuthGuard` global; `@Roles(...)` per endpoint; object-level checks inside services.
- Every list endpoint paginates, filters by query param, and is clinic-scoped automatically.
- Money is `numeric(10,2)`, handled as strings. **Never float.**
- Errors are `{ statusCode, message, error }`; Arabic wording is resolved on the front end by code.
- Every schema change is a committed `drizzle-kit generate` migration. Never edit an applied one.

## Frontend

- Functional components, hooks, TanStack Query. Feature folders mirror the API modules.
- **RTL by default.** Gregorian dates, Arabic through i18n. `check:i18n` fails on an Arabic literal
  in a component and on a key missing from either locale.
- Dropdowns read the clinic's lists through `useLookupOptions` / `useLookupLabels`, never a constant.
- Role-aware UI is cosmetic; the API is the boundary. Never link to a page the reader would be
  bounced off — check the helper the route guard uses.
- **A view somebody can reach is a view somebody can link to.** Tabs and filters live in the URL,
  never `useState`. A retired route redirects, it does not disappear.
- **Navigation is one table.** `app/navigation.ts` lists sections and roles; the route guards are
  built from the same sets.
- The top bar reads search-first, actions-last, in logical properties.

### The interface system

`packages/ui`, imported as `@clinic/ui`. One library, many branded copies, so nothing inside names a
clinic or a colour. `base.css` declares every token with a neutral default; a product's
`theme.css`/`theme.ts` supplies values — **values, never new token names**. Change a component
through its `className` or a `data-part`, never a fork.

- **Two control heights and no third:** `--control-h` for a target (field, button, chip),
  `--control-h-sm` for a compact row (tab, segment, table-row button, badge). A third is a token
  change.
- **Type comes from a token.** `pnpm lint:type` fails on any font size or line height written at a
  call site. The scale is in `base.css` against a 16px root; nothing carrying content is under 12px.
- **One of each primitive.** One pill, one menu, one field box; the rest are variants. `fieldShell()`
  draws every input, select and picker trigger.
- **A dialog focuses nothing when it opens**, and a picker opens on click, Enter, Space or
  ArrowDown — never on focus.
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
- **Web** Vitest, all specs under `apps/web/test`, in three lanes:
  - `pnpm test` — jsdom, the fast lane, everything that is logic or behaviour.
  - `pnpm --filter @clinic/web test:browser` — `*.browser.test.tsx` in real Chromium, for what jsdom
    cannot do: computed tokens, layout and geometry, focus, direction. A browser session will not
    attach while jsdom runs beside it, so it is a separate step.
  - the node lane for the dev proxy.
- Every role's sidebar is asserted **as a whole list** — the failure that matters is an entry
  appearing for somebody it was never meant for. Each route guard is asserted per role, and each
  retired address is asserted to land on its replacement.
- **Direction and spacing are still verified by a person on the sandbox.** A pull request that
  changes what a screen looks like carries screenshots in its description, in Arabic RTL, at the
  widths it touches. Screenshots are never committed.

## Versioning & deploy

The version is `<major>.<minor>` from the root `package.json` plus the commit count, resolved at
deploy and never stored. `APP_VERSION` reaches the API as an environment variable and the web as a
build arg; without them the answer is `0.0.0-dev`. The API serves `/version`; the web shows the
API's beside its own only when they differ.

CI and the deploy are one chain on `main`: checks, then images, then the sandbox. A failure stops
the deploy. The same checks also run on every pull request, so nothing merges untested.

## Never

- store or expose an editable balance or quantity
- hard-delete a medical or financial row
- use a float for money
- skip the audit interceptor on a financial or medical mutation
- return medical fields in a receptionist response
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

**Default: no comment.** Code explains itself through naming.

A comment is allowed only for a non-obvious **why** that code cannot express — a workaround and its
cause, a security, bidi or ledger invariant — or a one-line JSDoc on a shared or public utility.

**Maximum three lines.** No narrative, no storytelling, no design rationale in code — that belongs in
the pull request description. Never restate what the code already says.
