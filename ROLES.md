# ROLES.md — Roles & Permissions Specification

Authoritative spec for authorization. Every endpoint must map to a row here before it is implemented. Enforcement is **at the API level** (guards + service checks + response serialization). UI hiding is cosmetic only.

## Roles

| Role | Code | Who |
|---|---|---|
| Admin | `admin` | Clinic owner/manager |
| Doctor | `doctor` | Treating physician (linked to a `doctors` row) |
| Technician | `technician` | Clinic technician handling labs & inventory |
| Receptionist | `receptionist` | Front desk: registration, appointments, payments |
| Public | — | Anonymous patient on the booking page (no account) |

Users belong to one clinic and have exactly one role (v1). `admin` implicitly passes every role check within their clinic.

## Global rules

1. **Clinic scoping:** every authenticated request is scoped to the user's `clinic_id`. Cross-clinic access is impossible regardless of role. Applied automatically in a base query helper — never rely on the client sending `clinic_id`.
2. **Doctor ownership:** doctors see full medical records of patients they have treated or who have an appointment with them. Admin sees all. (v1 simplification: any doctor in the clinic may open any patient's medical record — flag `STRICT_DOCTOR_SCOPE` exists to tighten later.)
3. **Field-level security:** role determines not just access to an endpoint but **which fields are serialized**. Separate response schemas per sensitivity level (see below).
4. **Financial mutations** (charges, payments, lab payments, stock adjustments) always write to the audit log with old/new values.
5. **Nothing is hard-deleted** by any role. "Delete" = soft delete; only `admin` can soft-delete financial records, and only `admin` can view/restore soft-deleted rows.

## Permission matrix

Legend: **C** create · **R** read · **U** update · **D** soft-delete · — none

### Core
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Clinic settings, templates | CRUD | R | R | R |
| Users & roles | CRUD | — | — | — |
| Doctors & schedules | CRUD | R (own U: schedule off-days) | R | R |
| Specialties & procedure catalog | CRUD | R | R | R (names/prices only) |
| Audit log | R | — | — | — |

### Patients
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Patient basic info (name, phone, dob, address) | CRUD | CRU | R | CRU |
| Medical history & allergies | CRUD | CRU | R (allergy flags only) | — |
| Visits (complaint, exam, diagnosis) | CRUD | CRU | — | — |
| Performed procedures & chart marks | CRUD | CRU | R (lab-linked only) | — |
| Treatment plans | CRUD | CRU | — | — |
| Attachments / X-rays | CRUD | CRU | R (lab-linked only) | — |
| Prescriptions | CRUD | CRU | — | — |
| Patient timeline (full) | R | R | — | R (financial + appointment entries only) |

### Billing
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Charges (from procedures) | CRUD | CR (own patients) | — | R (amounts only) |
| Discounts | CRU | CR (with reason) | — | — |
| Payments & receipts | CRUD | R | — | CR (cannot update/delete) |
| Patient balance & statement | R | R (own patients) | — | R |
| Overdue balances list | R | — | — | R |
| Clinic expenses | CRUD | — | — | — |

### Appointments & booking
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Calendar (all doctors) | R | R (own) | R | R |
| Appointments | CRUD | CRU (own) | — | CRUD |
| Waiting list | CRUD | R | — | CRUD |
| Booking settings (rules, windows) | CRU | — | — | R |
| Public slot listing + create booking | — | — | — | — (public endpoints, rate-limited, OTP) |

### Labs
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Labs directory & prices | CRUD | R | CRU | — |
| Lab orders | CRUD | CRU (create/edit own; not financial fields) | RU (status transitions, receiving) | — |
| Lab payments | CRUD | — | CR | — |
| Lab balances & statements | R | R | R | — |

### Inventory
| Resource | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Items & suppliers | CRUD | R | CRU | — |
| Stock movements: purchase | CRUD | — | CR | — |
| Stock movements: consume | CRUD | CR | CR | — |
| Stock movements: adjust (with reason) | CRUD | — | CR | — |
| Alerts (low stock, expiry) | R | R | R | — |

### Reports
| Report | admin | doctor | technician | receptionist |
|---|---|---|---|---|
| Dashboard (full) | R | R (own KPIs) | R (labs+stock widgets) | R (appointments+today's cash) |
| Revenue / expenses / profit | R | R (own revenue only) | — | — |
| Patients & balances | R | R (own) | — | R |
| Appointments & attendance | R | R (own) | — | R |
| Labs reports | R | R | R | — |
| Inventory reports | R | R | R | — |

## Field-level response schemas

Define per-entity serializers in `packages/shared`:

- `PatientPublicView` — id, file number, name, phone, dob, balance. → receptionist, technician.
- `PatientClinicalView` — everything. → admin, doctor.
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
