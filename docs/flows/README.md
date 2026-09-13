# Flow screenshots

Arabic, RTL, captured against the development seed (`pnpm seed`) with `vite preview`. These are the
three flows redesigned in the inline-registration change, kept here so a pull request can point at
them rather than at a description of them.

| File                           | What it shows                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `01-inline-patient-offer.png`  | The booking form's patient search finding nobody, offering `+ مريض جديد: {name}` |
| `02-inline-patient-fields.png` | The four inline fields that offer opens, inside the same dialog                  |
| `03-search-without-hamza.png`  | `احمد` finding `أحمد خالد الحسن` — exact-folded first, the fuzzy match under it  |
| `05-doctor-one-step.png`       | One form for the account, the specialty and the week, opened on "new user"       |
| `08-booking-urgent-form.png`   | The public page's urgent request: name, phone, complaint, no slot                |
| `09-booking-urgent-sent.png`   | What it says afterwards — a call back, never a time                              |
| `10-reception-queue.png`       | The queue with those requests in it, and the three actions on each               |

They are not regression fixtures. The sweep that measures screens is `pnpm qa:screens`
(`docs/visual-qa.md`); it writes elsewhere and is not committed.
