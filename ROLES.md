# ROLES.md — Roles & Permissions Specification

Authoritative spec for authorization. Every endpoint must map to a row here before it is implemented. Enforcement is **at the API level** (guards + service checks + response serialization). UI hiding is cosmetic only.

## Roles

| Role | Code | Who |
|---|---|---|
| Admin | `admin` | Clinic owner/manager |
| Doctor | `doctor` | Treating physician (linked to a `doctors` row) |
| Visiting doctor | `visiting_doctor` | External doctor who treats some of the clinic's patients (linked to a `doctors` row); see [Visiting doctor](#visiting-doctor) |
| Technician | `technician` | Clinic technician handling labs & inventory |
| Receptionist | `receptionist` | Front desk: registration, appointments, payments |
| Public | — | Anonymous patient on the booking page (no account) |

Users belong to one clinic and have exactly one role (v1). `admin` implicitly passes every role check within their clinic.

**Every permission is a capability a clinic can change.** The matrix below is the shipped default. Each endpoint is a capability, and so is each data rule below (`RULE` in `packages/shared`); the Permissions page grants or withdraws any of them per role. The sidebar and the route guards follow the same capabilities, so a page appears the moment its list capability is granted.

**Paid modules** sit above the matrix. A clinic has a `modules` list, empty by default; while a module is off its capabilities are refused to everyone, admin included, and leave the session and the Permissions page. Only the vendor switches one on: `pnpm -C apps/api module:enable <clinic slug> <module>` (and `module:disable`, `module:list`). Today's module is `assistant`: every `/ai` route, the AI query, and the daily follow-ups.

| Rule capability | Decides | Default roles (admin always) |
|---|---|---|
| `patients.list` / `patients.findOne` | The patient list and a patient file | doctor, visiting doctor, receptionist, technician |
| `patients.clinical` | Medical fields, the chart and prices, clinical timeline entries | doctor, visiting doctor, technician |
| `patients.financial` | Balances, the balance filter and sort, payment and charge timeline entries | doctor, technician, receptionist |
| `patients.all` | Every patient; without it, only assigned patients (the visiting doctor rule) | doctor, receptionist, technician |
| `procedure-catalog.details` | The full catalog; without it, names and prices only | doctor, visiting doctor, technician |
| `appointments.allCalendars` | Every doctor's calendar, lab orders, time off and extra hours; without it, one's own | receptionist, technician |
| `lab-orders.setPrice` | Setting the price of lab work | receptionist, technician |
| `doctors.allSchedules` | Changing any doctor's weekly hours; without it, one's own | — |
| `notes.manageAll` | Editing or deleting another person's note | — |
| `payments.viewDeleted` | Deleted payments in the statement | — |
| `dashboard.overdue` | The overdue balances widget | doctor, technician, receptionist |

## Global rules

1. **Clinic scoping:** every authenticated request is scoped to the user's `clinic_id`. Cross-clinic access is impossible regardless of role. Applied automatically in a base query helper — never rely on the client sending `clinic_id`.
2. **Doctor ownership:** doctors see full medical records of patients they have treated or who have an appointment with them. Admin sees all. (v1 simplification: any doctor in the clinic may open any patient's medical record — flag `STRICT_DOCTOR_SCOPE` exists to tighten later.)
3. **Field-level security:** role determines not just access to an endpoint but **which fields are serialized**. Separate response schemas per sensitivity level (see below).
4. **Financial mutations** (charges, payments, lab payments, stock adjustments) always write to the audit log with old/new values.
5. **Assigned patients only, for a visiting doctor:** a patient with an appointment or a treatment (planned or performed) assigned to their `doctors` row. Any other patient — and every record hanging off one, by path, by query or by its own id — is a 404, the same answer as another clinic's.
6. **Nothing is hard-deleted** by any role. "Delete" = soft delete; only `admin` can soft-delete financial records, and only `admin` can view/restore soft-deleted rows.

## Permission matrix

Legend: **C** create · **R** read · **U** update · **D** soft-delete · — none

Shipped defaults, each changeable per clinic on the Permissions page. Doctor and technician share the clinic's working rights; a technician does not write prescriptions or visits, or change a doctor's hours. Admin alone keeps users, payroll and settlements, clinic settings and closures, lists and the treatment catalog, permissions, translations, the audit log, the assistant's settings and keys, every soft-delete and every money reversal.

### Core
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Clinic settings, templates | CRUD | R | R | R |
| Users & roles | CRUD | own RU¹ | own RU¹ | own RU¹ |
| Doctors & schedules | CRUD | R (own U: schedule) | R | R |
| Doctor time off | CRUD | R (own CRUD) | R | R |
| Clinic closures | CRUD | R | R | R |
| Specialties & procedure catalog | CRUD | R | R | R (names/prices only) |
| Clinic notes (noticeboard) | CRUD | CRU (own) | CRU (own) | CRU (own) |
| Audit log | R | — | — | — |

### Patients
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Patient basic info (name, phone, dob, address) | CRUD | CRU | CRU | CRU |
| Medical history & allergies | CRUD | CRU | CRU | — |
| Visits (complaint, exam, diagnosis) | CRUD (D blocked while payments cover its charges) | CRU | R | — |
| Treatments (planned, in progress, done, cancelled) & chart marks | CRUD | CRUD (D blocked while payments cover its charge) | CRUD (as doctor) | — |
| Attachments / X-rays | CRUD | CRU | CRU | — |
| Prescriptions | CRUD | CRUD | R | — |
| Patient timeline (full) | R | R | R | R (financial + appointment entries only) |

### Billing
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Charges (from procedures) | CRUD | CR | CR | R (amounts only) |
| Discounts | CRU | CR (with reason) | CR (with reason) | — |
| Payments & receipts | CRUD | CR | CR | CR (cannot update/delete) |
| Patient balance & statement | R | R | R | R |
| Overdue balances list | R | R | R | R |
| Clinic expenses | CRUD | — | — | — |

### Appointments & booking
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Calendar (all doctors) | R | R (own) | R | R |
| Appointments | CRUD | CRU (own) | CRU | CRU |
| Waiting list | CRUD | CRU | CRU | CRU |
| Online booking requests | RU (confirm, reject) | RU | RU | RU |
| Booking settings (rules, windows) | CRU | — | — | R |
| Public slot listing + create booking | — | — | — | — (public endpoints, rate-limited, OTP) |

### Labs
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Labs directory & prices | CRUD | CRU | CRU | — |
| Lab orders | CRUD | CRU (own; every transition; not the price) | CRU (every transition and the price) | — |
| Lab payments | CRUD (reversal admin only) | CR | CR | — |
| Lab balances & statements | R | R | R | — |

### Inventory
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Items & suppliers | CRUD | CRU | CRU | — |
| Stock movements: purchase | CRUD | CR | CR | — |
| Stock movements: consume | CRUD | CR | CR | — |
| Stock movements: adjust (with reason) | CRUD | CR | CR | — |
| Alerts (low stock, expiry) | R | R | R | — |

### Reports
| Report | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Dashboard (full) | R | R (own KPIs, overdue) | R (whole clinic, overdue) | R (appointments, overdue, today's cash) |
| Revenue / expenses / profit | R | R (own revenue only) | — | — |
| Patients & balances | R | R (own) | — | R |
| Appointments & attendance | R | R (own) | — | R |
| Labs reports | R | R | R | — |
| Inventory reports | R | R | R | — |

### Visiting doctor

Everything a `doctor` may do on a patient's clinical record, scoped by global rule 5, and nothing else:

| Resource | visiting_doctor |
|---|---|
| Patient basic info | R (assigned) |
| Medical history & allergies, visits, treatments & chart marks, attachments, prescriptions | as `doctor`, on assigned patients |
| Patient timeline | R (assigned; clinical entries and appointments, no payments, charges, lab or supply entries) |
| Appointments & calendar | R (own) |
| Doctors list | R |
| Billing, labs, inventory, waiting list, reports, assistant | — |

A visiting doctor is a contractor, not staff. Only `admin` creates one, from the Doctors page (`POST /doctors/visiting`): the account and its `doctors` row together, with a specialty, a default appointment length, optional working days and the clinic's share, and without a password. Without working days they are bookable any time the clinic is open. They are never offered on the public booking page. The users screen may not create or assign the role. The admin activates the account later by invitation or by setting a password.

**Settlement.** Only `admin` sees and changes a visiting doctor's settlement (`/doctors/:id/settlement`, `/settlement-treatments/:id`, `/doctors/:id/payouts`, `/doctor-payouts/:id/reverse`): per done treatment, price after discount − materials = net; the clinic takes its percentage of the net (the doctor's default, or a per-treatment override, down to 0) and the rest is the doctor's. Materials default to linked lab work plus stock used, and can be overridden (0 included). Payments to the doctor are an append-only ledger corrected by reversal. The clinic's share is never serialized on the doctor record.

**Own account.**¹ Every signed-in user, a visiting doctor included, reads and edits their own account through the same routes the admin uses (`GET`/`PATCH /users/:id`, `/users/:id/photo*`, `POST /users/:id/send-password-reset` on their own id): name, phone, email and photo, and a password link to their own email, which opens the secure set-password page. There is no in-app password change. A role, status or joining date is the admin's; changing your own is a 403. Another user's account is a 403 unless the clinic grants the capability.

**Payroll.** Only `admin` sees or changes pay (`/payroll/*`, `/payroll-adjustments/:id/reverse`, `/staff-payments/:id/reverse`). Every staff member except a visiting doctor has a monthly salary that applies from a month onward (a raise is a new row; earlier months keep theirs) and a joining date, never in the future; they appear from the month they joined. Per month: salary + extras − cuts = due; due − paid = remaining. Extras, cuts and payments are append-only and corrected by reversal. Closing a month freezes its salaries, extras and cuts; payments and their reversals still go through. One `staff_payments` ledger holds both salaries and visiting-doctor settlements, and the month's staff cost is salaries due plus visiting-doctor shares.

The defaults above, like every other role's, are what the permissions screen starts from; `admin` may widen or narrow them per clinic.

## Field-level response schemas

Define per-entity serializers in `packages/shared`:

- `PatientPublicView` — id, file number, name, phone, dob, balance. → receptionist, technician.
- `PatientClinicalView` — everything but the balance for a visiting doctor. → admin, doctor, visiting_doctor.
- `LabOrderTechView` — no patient medical context beyond tooth/work info.
- Receptionist responses must **never** include: diagnoses, visit notes, medical history details, prescriptions, attachment keys/URLs.
- Technician responses must never include: financial patient data, non-lab medical details (allergy *flag* is allowed for safety).

## Enforcement implementation (NestJS)

1. `JwtAuthGuard` — global, except `@Public()` booking endpoints.
2. `RolesGuard` + `@Roles('doctor', 'admin')` — endpoint-level.
3. `ClinicScopeInterceptor` / base repository helper — injects `clinic_id` into every query.
4. Service-level checks — ownership (doctor ↔ patient/appointment), state-transition validity, `STRICT_DOCTOR_SCOPE`.
5. Response DTO chosen **by role**, not by endpoint alone.
6. `AuditInterceptor` on all financial/medical mutation endpoints.
7. Public booking: rate limiting (`@nestjs/throttler`), phone OTP, no enumeration (booking lookup only via signed token link).

## Required permission tests (minimum)

For each role, one test per ✗ cell that matters most:
- receptionist requesting a patient's clinical view → 403 / stripped fields
- receptionist updating or deleting a payment → 403
- doctor reading another doctor's revenue report → 403
- technician reading billing endpoints → 403
- any authenticated user querying another clinic's resource id → 404
- public endpoint accessing anything beyond slots/booking → 401
- non-admin reading audit log or soft-deleted rows → 403
- receptionist writing a clinic closure → 403 (they read them: a closure they cannot see is a day they will book into)
- any role editing or deleting a clinic note somebody else wrote → 403; the admin → allowed
- doctor writing time off in another doctor's calendar → 403; in their own → allowed
- a closure or time off over booked appointments without `force` → 409 carrying the affected appointments
- deleting a procedure, or a visit, whose charges the patient's payments cover → 409; the charge of one that is removable is reversed, never deleted
- receptionist deleting a visit or a procedure → 403
- visiting doctor opening an unassigned patient, or any record of one, by path, query or id → 404; an assigned one → allowed
