# Visual QA

Two tools over one list of screens.

- **`pnpm qa:screens`** — the sweep. Signs in as each role, walks every screen
  at three viewports in both languages, writes a PNG of each and a report of
  what it measured. For a person to look at.
- **`pnpm test:e2e`** — the smoke run. The cheap half of the same walk, as
  Playwright assertions, on every pull request.

Both read `scripts/qa/screens.mjs`. A screen added there is picked up by both;
a screen added to only one of them would be swept and never tested, or tested
and never looked at.

## Running the sweep

The sweep drives a real browser against a real stack, so the stack has to be
up and seeded:

```bash
cp .env.example .env
docker compose up -d          # or: pnpm dev, with Postgres running
pnpm seed
pnpm qa:screens
```

It writes as well as reads: the booking wizard's OTP screen is reached by
submitting the form, so each sweep leaves one pending booking per viewport in
the database it ran against. That is the point — the screen only exists after
a real submission — but it is a reason to run this against a development
stack and to re-seed when the queue gets noisy.

Output lands in `qa/screens/` (git-ignored), one directory per
language / viewport / role, plus `report.md` and `report.json`.

```
qa/screens/ar/phone/doctor/patient-file-chart.png
qa/screens/en/desktop/admin/audit-log.png
qa/screens/ar/phone/public/booking-when-step.png
qa/screens/report.md
```

Narrow it while working on one thing:

```bash
QA_LANGS=ar QA_VIEWPORTS=phone pnpm qa:screens
QA_ROLES=technician QA_SCREENS=inventory pnpm qa:screens
```

| variable       | default                 | what it does                                    |
| -------------- | ----------------------- | ----------------------------------------------- |
| `QA_BASE_URL`  | `http://127.0.0.1:5173` | where the web app is                            |
| `QA_API_URL`   | `http://127.0.0.1:3000` | where the API is — used to find seeded ids      |
| `QA_LANGS`     | `ar,en`                 | languages to sweep                              |
| `QA_VIEWPORTS` | `phone,tablet,desktop`  | 390×844, 768×1024, 1440×900                     |
| `QA_ROLES`     | all four                | roles to sign in as                             |
| `QA_SCREENS`   | —                       | substring filter on the screen id               |
| `QA_OUT`       | `qa/screens`            | output directory                                |
| `QA_CHROMIUM`  | —                       | path to a Chromium, instead of Playwright's own |

## What the report says

The sweep does not judge a design. It reports three things a browser measures
better than an eye, and leaves the rest to the person looking at the PNGs:

- **Horizontal overflow** — the document scrolling sideways, with the widest
  offending element named. Nothing in this app should ever do this.
- **Tap targets under 44px** — WCAG 2.5.8, and the reality of a phone held in
  one hand at the chair.
- **Text clipped by its own box** — an element whose content is taller than the
  box it is in. In Arabic this is usually a descender cut off by a line height
  that was tuned against Latin.

It also collects console errors per screen, which is how a `<button>` nested
inside a `<button>` was found in the suppliers list, and lists any step it
could not perform — a drawer that would not open is a finding, not a crash.

## Adding a screen

Add a row to `scripts/qa/screens.mjs`:

```js
{ id: 'inventory-shopping-list', path: '/inventory/shopping-list', roles: STORE },
```

`roles` are the roles the router lets in — the sweep signs in as each of them,
and the smoke run asserts the screen renders for each of them.

A state a URL cannot reach (a drawer, a modal, an open menu) gets `steps`,
which are data rather than code so the same row runs in both languages:

```js
{
  id: 'inventory-item-drawer',
  path: '/inventory?tab=stock',
  roles: STORE,
  steps: [{ firstRow: true }, { wait: 500 }],
}
```

| step                                      | opens                                                |
| ----------------------------------------- | ---------------------------------------------------- |
| `{ click: 'patients.create' }`            | a button, by i18n key                                |
| `{ clickTab: 'patients.tabs.visits' }`    | a tab, by i18n key                                   |
| `{ clickRadio: 'appointments.day' }`      | one option of a segmented control                    |
| `{ clickSelector: '[data-tooth]' }`       | anything with a stable attribute                     |
| `{ clickLabelPrefix: 'when.chooseSlot' }` | an `aria-label` built from a key with a placeholder  |
| `{ firstRow: true }`                      | the first row of a list (`[data-row]`, either shape) |
| `{ fill: { selector, value } }`           | types into a field                                   |
| `{ clickSubmit: true }`                   | the form's submit button                             |
| `{ wait: 500 }`                           | lets an animation settle                             |

Screens with `steps` are swept but not smoke-tested: CI checks what a URL can
reach, which keeps it fast enough to run on every pull request.

## The rules the sweep exists to protect

- Every number — phone, money, date, time, file number, tooth, OTP — is an
  `<Ltr>`. It carries its own direction, isolates itself from the text around
  it, and hugs its content so the _page's_ alignment places it.
- No unprefixed physical CSS. `ps`/`pe`, `ms`/`me`, `text-start`/`text-end`,
  `border-s`/`border-e`, `start`/`end`. The exception is a `dir="ltr"` field,
  which has to be laid out against the page rather than against itself: those
  use `page-rtl:`/`page-ltr:`, two custom variants that ask an ancestor rather
  than the element, because Tailwind's own `rtl:`/`ltr:` match both and leave
  the winner to the order the utilities were emitted in.
- Direction-relative icons (`chevron-start`, `chevron-end`, and the two door
  glyphs) resolve per direction; a phone, a calendar and a printer never flip.
- Line heights are set for Arabic: ~1.6 through body text, ~1.3 on display
  sizes.
- 44px tap targets below `lg` — a 768px tablet is a touch device whatever the
  layout does at that width — and the drawn heights above it. Two exceptions
  the report still lists: a tooth on the chart is 30px wide, because sixteen
  of them at 44px is a 700px arch, and it is 74px tall to compensate; and a
  switch's own box is 24px tall inside a 44px hit area that the report
  measures the box of rather than the area.

`direction.test.tsx` fails the build on the first two.
