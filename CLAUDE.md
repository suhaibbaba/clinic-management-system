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

### Files & images
- Upload via presigned R2 URLs from the API; store only key + metadata in DB; serve via short-lived signed URLs. Receptionist role never receives attachment URLs.

### Testing
- Backend: Jest. Minimum required coverage: balance computation, slot availability/conflicts, permission boundaries per role (see ROLES.md test matrix), lab-order state transitions, audit log writes.

### Language
- Code, comments, commits, API: English. UI strings: Arabic via i18n. Commits: conventional commits (`feat(billing): ...`).

## Never
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
