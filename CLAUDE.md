# CLAUDE.md — Clinic Management System

## Project overview

A web-based clinic management system. The first client is a dental clinic, but the system is **multi-specialty by design** (dentistry, orthopedics, ...). Never hardcode dental-only logic outside the dental specialty configuration.

Everything revolves around the **patient record**: appointments, visits, treatments, X-rays, lab orders, and payments all attach to the patient and appear in one timeline. Balances and stock quantities are **always computed from transactions — never stored as editable fields**.

Roles and permissions are specified in **ROLES.md** — read it before implementing any endpoint.

## Tech stack

- **Backend:** NestJS on the **Fastify adapter**, TypeScript strict mode
- **ORM:** Drizzle ORM + PostgreSQL, migrations via `drizzle-kit`
- **Frontend:** React + Vite, RTL-first Arabic UI with i18n (Arabic default, English later)
- **Shared:** monorepo (pnpm workspaces) with `packages/shared` for Zod schemas and TypeScript types used by both API and web
- **Validation:** Zod everywhere — DTOs are Zod schemas (via `nestjs-zod`), reused on the frontend
- **File storage:** Cloudflare R2 (S3-compatible) via presigned URLs — no files in the DB, no public URLs for medical images
- **Notifications:** WhatsApp Business API / local SMS gateway behind a `NotificationsService` abstraction; reminders via `@nestjs/schedule`
- **Auth:** JWT (short-lived access + refresh), role-based guards
- **Target infra:** single cheap VPS (Node + Postgres), R2 for files. Keep memory footprint low — no heavyweight dependencies without justification.

## Repo layout

```
apps/
  api/        NestJS app — one Nest module per domain module below
  web/        React app — one feature folder per domain module
packages/
  shared/     Zod schemas, shared types, enums, constants (FDI numbering, statuses)
```

## Architecture decisions

1. **Multi-clinic + multi-specialty from day one.** Every domain table carries `clinic_id`. Specialty-specific behavior (tooth chart vs. skeleton chart, procedure catalogs, lab work types) is configuration/data, not code branches.
2. **Ledger pattern for money and stock.** `charges`, `payments`, `lab_orders`, `lab_payments`, `stock_movements` are append-only. Patient balance = sum(charges) − sum(payments). Lab balance and stock quantity are computed the same way (SQL aggregate or view). Corrections are new reversing entries, not edits.
3. **Soft delete only** for medical and financial records (`deleted_at`), plus `created_by` / `updated_by` / `created_at` / `updated_at` on every table.
4. **Audit log** on every create/update/delete of financial and medical data: user, time, entity, old value, new value (JSONB). Implemented as a NestJS interceptor + service. Immutable — no update/delete API for it.
5. **Interactive charts:** teeth use FDI numbering (11–48, deciduous 51–85). A `chart_marks` table links a treatment to a location (tooth + surface, or body region) generically per specialty.
6. **Public booking is anonymous:** no patient accounts. Phone number is the identity key; OTP or reception confirms. Slot computation from doctor schedules minus existing appointments — never store "free slots".
7. **State machines as data:** statuses are string enums in `packages/shared`; allowed transitions validated in services (e.g. lab order: draft → sent → ready → received → fitted, with sent ← returned loop).
8. **Every user-facing choice list is data, never a hardcoded array.** Options live in `lookup_options`, one row per option, scoped per clinic and grouped by `list_key` — tooth states, lab work types, materials and shades, attachment types, appointment types, inventory categories and units, payment methods, frequent drugs. A clinic adds "veneer" to the tooth chart or "شيك" to the payment methods in settings → القوائم, without a deploy. Adding a list is a `list_key` plus its rows in `SYSTEM_LOOKUPS`; adding an option is not a code change at all. Built-in rows are seeded with `is_system = true`: their names and colours are editable — that is what people read — but they cannot be deleted or switched off, because the application refers to them by code.
   **The exception is a status that drives a state machine** (decision 7 above): appointment status, lab order status, stock movement direction. Those stay code enums, because the transition table, the permissions and the arithmetic are written against those exact values, and making them editable would let a clinic add a status nothing knows how to move out of. Behaviour is code; the words on a dropdown are data.

## Modules (build in this order)

1. **core** — clinics, specialties, doctors, users/roles, settings, audit log
2. **patients** — patients, medical history, visits, treatment plans, performed procedures, chart marks, attachments (X-rays), prescriptions
3. **billing** — procedure catalog (prices per specialty), charges, payments, receipts/invoices (PDF), statements
4. **appointments** — internal calendar, statuses, conflict prevention, waiting list
5. **booking** — public booking endpoints + page, slot computation, OTP confirm, cancel/reschedule links
6. **notifications** — templates, WhatsApp/SMS sending, reminder scheduler
7. **labs** — labs, lab orders (state machine), lab payments, statements
8. **inventory** — items, stock movements (purchase/consume/adjust), suppliers, expiry & low-stock alerts
9. **reports** — dashboard, revenue/patients/appointments/labs/inventory reports, Excel/PDF export

## Conventions & rules

### Backend (NestJS)
- One Nest module per domain module; inside: `controller` (thin) → `service` (business logic) → Drizzle queries. No business logic in controllers or schemas.
- DTOs: Zod schemas from `packages/shared` wrapped with `createZodDto`. Never duplicate validation.
- Guards: `JwtAuthGuard` global; `@Roles(...)` + `RolesGuard` per endpoint; object-level checks (clinic scope, doctor-owns-patient) inside services. See ROLES.md.
- Every list endpoint: pagination (`page`/`limit`), filtering via query params, scoped to the caller's `clinic_id` automatically.
- Money: Postgres `numeric(10,2)`, handled as strings/`Decimal` in TS — **never float**.
- Errors: Nest exceptions with a consistent shape `{ statusCode, message, error }`; Arabic-facing messages resolved on the frontend by error code, not by backend strings.
- Migrations: every schema change through `drizzle-kit generate` + committed SQL. Never edit an applied migration.

### Frontend (React)
- Functional components + hooks; feature folders mirror backend modules; TanStack Query for server state.
- RTL layout by default (`dir="rtl"`); test every screen in RTL. Gregorian dates, Arabic labels via i18n files — never hardcode Arabic strings in components.
- Role-aware UI: hide what the role can't do, but treat UI hiding as cosmetic — the API is the real boundary.
- Dropdowns read the clinic's own lists through `useLookupOptions` / `useLookupLabels`, never a constant. `pnpm --filter @clinic/web check:i18n` fails CI on an Arabic literal in any `.ts`/`.tsx` under `src`, and on a key present in one locale file and missing from the other.
- **Navigation is one table.** `app/navigation.ts` lists the sidebar's sections and its settings group with the roles that see each; the route guards in `app/router.tsx` are built from the same sets, so a hidden entry is not reachable by typing its address either. Adding a screen means adding a row there, not a `<Route>` somewhere and a link somewhere else.
- **A view somebody can reach is a view somebody can link to.** Tabs and list filters live in the URL (`useTabParam`, or a query param read straight from `useSearchParams`) — never in `useState`. A panel whose state is invisible to the address bar cannot be linked to, bookmarked, deep-linked from the dashboard, or redirected to from the route it replaced.
- **A retired route redirects, it does not disappear.** When a page is merged into a tab or a filter, its old address stays in the router as a `<Navigate>` to the tab that replaced it.
- **A response's shape is the permission.** Where the API omits a field a role may not read, the screen draws what it was sent rather than consulting a copy of the matrix — a card with no figure behind it is not rendered at all. And never link to a page the reader would be bounced off: check the same helper the route guard uses.

### Files & images
- Upload via presigned R2 URLs from the API; store only key + metadata in DB; serve via short-lived signed URLs. Receptionist role never receives attachment URLs.

### Testing
- Backend: Jest. Minimum required coverage: balance computation, slot availability/conflicts, permission boundaries per role (see ROLES.md test matrix), lab-order state transitions, audit log writes.
- Frontend: Vitest. Every role's sidebar is asserted as a whole list, not one label at a time — the failure that matters is an entry appearing for somebody it was never meant for, which a test of what *should* be there cannot see. Each route guard is asserted per role, and each retired address is asserted to land on its replacement.

### Language
- Code, comments, commits, API: English. UI strings: Arabic via i18n. Commits: conventional commits (`feat(billing): ...`).

### Versioning
- The version is **`<major>.<minor>` from the root `package.json` plus the repository's commit count** — `1.0` and 312 commits is `1.0.312`. It is resolved by the deploy (`scripts/app-version.mjs`, mirrored in shell for a VPS without node) and never stored: nothing bumps a file, nothing tags, nothing commits back to the branch. Every commit that reaches `main` is a new version, for free.
- **Major and minor are the human decision** and live in the root `package.json`; the third number says which build this is. Its patch field is ignored.
- The images cannot work it out — `.git` is not in the Docker build context — so it is **passed in**: `APP_VERSION` as an environment variable to the API, `VITE_APP_VERSION` as a build arg to the web, which inlines it. Anything started without them reports `0.0.0-dev`, which is the honest answer and looks like one.
- The API serves it at `/version`; the web shows it on the settings screen and shows the API's beside it **only when they differ**, which is how a browser holding a stale bundle announces itself.

## Never
- put a tab or a list filter in `useState` when somebody might link to it — it belongs in the URL
- drop a route that a page used to live at; redirect it to whatever replaced it
- hardcode a user-facing choice list — it belongs in `lookup_options` (see architecture decision 8); a status that drives a state machine is the exception, and stays an enum
- write a user-facing string in a component — every word comes from the locale files, in both languages
- store or expose a manually editable "balance" or "quantity" field
- hard-delete medical or financial rows
- return medical fields in receptionist-role responses (see ROLES.md field rules)
- put dental-specific logic in core/billing/appointments modules
- use floats for money
- skip the audit interceptor on a financial/medical mutation
- commit secrets — environment variables only (`.env` gitignored, `.env.example` maintained)

## Current phase

**Phase 1 (MVP):** core + patients (tooth chart & X-rays) + billing + internal appointments + roles & audit log.
**Phase 2:** public booking + notifications, labs, inventory.
**Phase 3:** reports & dashboard, prescriptions/medical reports polish, second specialty chart, expenses, Excel import.
