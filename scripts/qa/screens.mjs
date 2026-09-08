/**
 * The catalogue of screens the visual QA sweep walks.
 *
 * One list, shared by `scripts/qa-screens.mjs` (the screenshot sweep) and
 * `tests/e2e/smoke.spec.ts` (the CI smoke run), so a screen added to the app
 * is added here once and both of them pick it up. A screen that only the
 * screenshot tool knew about would never be smoke-tested, and a smoke test
 * with its own list would drift from the sweep the first time a route moved.
 *
 * Every entry names the roles that may reach it — the same sets the router
 * guards use — because a sweep that signed in as a receptionist and asked for
 * the audit log would screenshot the dashboard it was bounced to and file it
 * under the wrong name.
 *
 * `steps` are the states a URL cannot reach on its own: a drawer, a modal, an
 * open menu. They are expressed as data rather than as code so the same entry
 * runs in both languages — labels are looked up by i18n key, never by the
 * Arabic or English string.
 */

export const ROLES = /** @type {const} */ (['admin', 'doctor', 'receptionist', 'technician']);

/** The seeded development accounts (apps/api/src/database/seed.ts). */
export const SEED_ACCOUNTS = {
  admin: { identifier: 'admin@clinic.local', password: 'ChangeMe123!' },
  doctor: { identifier: 'doctor@clinic.local', password: 'ChangeMe123!' },
  receptionist: { identifier: 'reception@clinic.local', password: 'ChangeMe123!' },
  technician: { identifier: 'technician@clinic.local', password: 'ChangeMe123!' },
};

/**
 * The three shapes the app is built for: a phone in a pocket at the chair, the
 * tablet at reception, and the desktop in the back office.
 */
export const VIEWPORTS = [
  { id: 'phone', width: 390, height: 844 },
  { id: 'tablet', width: 768, height: 1024 },
  { id: 'desktop', width: 1440, height: 900 },
];

export const LANGUAGES = ['ar', 'en'];

const ALL = ROLES;
const CLINICAL = ['admin', 'doctor'];
const FRONT_DESK = ['admin', 'doctor', 'receptionist'];
const LABS = ['admin', 'doctor', 'technician'];
const STORE = ['admin', 'technician'];
const ADMIN = ['admin'];

/**
 * Steps, as data.
 *
 * - `click`             a button by its i18n key
 * - `clickTab`          a tab by its i18n key
 * - `clickRadio`        one option of a segmented control, by its i18n key
 * - `clickSelector`     a CSS selector, for what has no label of its own
 * - `clickLabelPrefix`  an `aria-label` built from a key with a placeholder
 * - `firstRow`          opens the first row of a list — the drawer behind it
 * - `wait`              milliseconds, for an animation that has to settle
 */
export const SCREENS = [
  // ── The signed-out entry ────────────────────────────────────────────
  { id: 'login', path: '/login', roles: ALL, anonymous: true },

  // ── The sections of the sidebar ─────────────────────────────────────
  { id: 'dashboard', path: '/dashboard', roles: ALL },
  { id: 'profile', path: '/profile', roles: ALL },

  { id: 'patients', path: '/patients', roles: FRONT_DESK },
  {
    id: 'patients-balance-filter',
    path: '/patients?filter=balance',
    roles: FRONT_DESK,
  },
  {
    id: 'patients-new-modal',
    path: '/patients',
    roles: FRONT_DESK,
    steps: [{ click: 'patients.create' }, { wait: 400 }],
  },
  {
    id: 'patient-file-chart',
    path: '/patients/:patientId',
    roles: CLINICAL,
  },
  {
    id: 'patient-file-tooth-panel',
    path: '/patients/:patientId',
    roles: CLINICAL,
    steps: [{ clickSelector: '[data-tooth]' }, { wait: 400 }],
  },
  {
    id: 'patient-file-visits',
    path: '/patients/:patientId',
    roles: CLINICAL,
    steps: [{ clickTab: 'patients.tabs.visits' }, { wait: 400 }],
  },
  {
    id: 'patient-file-plans',
    path: '/patients/:patientId',
    roles: CLINICAL,
    steps: [{ clickTab: 'patients.tabs.treatmentPlans' }, { wait: 400 }],
  },
  {
    id: 'patient-file-attachments',
    path: '/patients/:patientId',
    roles: CLINICAL,
    steps: [{ clickTab: 'patients.tabs.attachments' }, { wait: 400 }],
  },
  {
    id: 'patient-file-timeline',
    path: '/patients/:patientId',
    roles: CLINICAL,
    steps: [{ clickTab: 'patients.tabs.timeline' }, { wait: 400 }],
  },
  {
    id: 'patient-file-billing',
    path: '/patients/:patientId',
    roles: FRONT_DESK,
    steps: [{ clickTab: 'patients.tabs.billing' }, { wait: 400 }],
  },
  {
    id: 'patient-file-long-name',
    path: '/patients/:longNamePatientId',
    roles: CLINICAL,
  },

  { id: 'appointments', path: '/appointments', roles: FRONT_DESK },
  {
    // Day and week are a `useState` toggle rather than a URL parameter, so the
    // day view is reached by clicking the control — on a phone it is the only
    // view offered and the control is not drawn at all.
    id: 'appointments-day',
    path: '/appointments',
    roles: FRONT_DESK,
    viewports: ['tablet', 'desktop'],
    steps: [{ clickRadio: 'appointments.day' }, { wait: 600 }],
  },
  {
    id: 'appointments-pending',
    path: '/appointments?status=pending',
    roles: FRONT_DESK,
  },
  {
    id: 'appointments-confirmed',
    path: '/appointments?status=confirmed',
    roles: FRONT_DESK,
  },
  {
    id: 'appointments-new-modal',
    path: '/appointments',
    roles: FRONT_DESK,
    steps: [{ click: 'appointments.create' }, { wait: 500 }],
  },
  {
    id: 'appointments-drawer',
    path: '/appointments',
    roles: FRONT_DESK,
    steps: [{ clickSelector: '[data-appointment]' }, { wait: 500 }],
  },

  { id: 'labs-orders', path: '/labs?tab=orders', roles: LABS },
  { id: 'labs-directory', path: '/labs?tab=directory', roles: LABS },
  {
    id: 'labs-order-drawer',
    path: '/labs?tab=orders',
    roles: LABS,
    // The board on a wide screen, a list of cards on a phone — either way,
    // the first thing that opens an order.
    steps: [{ clickSelector: '[data-lab-order], [data-row]' }, { wait: 600 }],
  },
  {
    id: 'labs-order-new-modal',
    path: '/labs?tab=orders',
    roles: LABS,
    steps: [{ click: 'labs.orders.add' }, { wait: 500 }],
  },
  { id: 'lab-page', path: '/labs/:labId', roles: LABS },

  { id: 'inventory', path: '/inventory?tab=stock', roles: STORE },
  { id: 'inventory-suppliers', path: '/inventory?tab=suppliers', roles: STORE },
  {
    id: 'inventory-item-drawer',
    path: '/inventory?tab=stock',
    roles: STORE,
    steps: [{ firstRow: true }, { wait: 500 }],
  },
  {
    id: 'inventory-new-item-modal',
    path: '/inventory?tab=stock',
    roles: STORE,
    steps: [{ click: 'inventory.addItem' }, { wait: 500 }],
  },
  { id: 'inventory-shopping-list', path: '/inventory/shopping-list', roles: STORE },

  // ── Settings ────────────────────────────────────────────────────────
  { id: 'clinic', path: '/clinic', roles: ADMIN },
  {
    // The working-hours accordion with a day open: the collapsed summaries are
    // what the screen is for, and the expanded panel is where the split shift
    // and the copy action live.
    id: 'clinic-hours-expanded',
    path: '/clinic',
    roles: ADMIN,
    steps: [{ clickSelector: '[data-testid="hours-day-0"] button:visible' }, { wait: 400 }],
  },
  {
    id: 'clinic-closure-modal',
    path: '/clinic',
    roles: ADMIN,
    steps: [{ click: 'schedule.closures.add' }, { wait: 400 }],
  },
  { id: 'doctors', path: '/doctors', roles: ADMIN },
  {
    id: 'doctors-new-modal',
    path: '/doctors',
    roles: ADMIN,
    steps: [{ click: 'doctors.create' }, { wait: 400 }],
  },
  {
    // The doctor's own page: the accordion again, and the time-off list beside
    // it. Reached through the doctors list, like every other `:id` screen here.
    id: 'doctor-page',
    path: '/doctors/:doctorId',
    roles: ADMIN,
  },
  {
    id: 'doctor-time-off-modal',
    path: '/doctors/:doctorId',
    roles: ADMIN,
    steps: [{ click: 'schedule.timeOff.add' }, { wait: 400 }],
  },
  { id: 'users', path: '/users', roles: ADMIN },
  {
    id: 'users-new-modal',
    path: '/users',
    roles: ADMIN,
    steps: [{ click: 'users.create' }, { wait: 400 }],
  },
  { id: 'lists', path: '/clinic/lists', roles: ADMIN },
  { id: 'audit-log', path: '/audit-log', roles: ADMIN },

  // ── The chrome itself ───────────────────────────────────────────────
  {
    id: 'chrome-user-menu',
    path: '/dashboard',
    roles: ALL,
    viewports: ['tablet', 'desktop'],
    steps: [{ clickSelector: '[aria-haspopup="menu"]:visible' }, { wait: 400 }],
  },
  {
    // Same menu, reached the way a phone reaches it.
    id: 'chrome-user-menu-phone',
    path: '/dashboard',
    roles: ALL,
    viewports: ['phone'],
    steps: [
      { click: 'nav.menu' },
      { wait: 400 },
      { clickSelector: '[aria-haspopup="menu"]:visible' },
      { wait: 400 },
    ],
  },
  {
    id: 'chrome-nav-drawer',
    path: '/dashboard',
    roles: ALL,
    viewports: ['phone'],
    steps: [{ click: 'nav.menu' }, { wait: 400 }],
  },
];

/**
 * The public booking wizard: no account, so it is swept once per language and
 * viewport rather than once per role.
 */
export const PUBLIC_SCREENS = [
  { id: 'booking-doctor-step', path: '/book/al-nour' },
  {
    id: 'booking-when-step',
    path: '/book/al-nour',
    steps: [{ clickLabelPrefix: 'doctor.choose' }, { wait: 900 }],
  },
  {
    id: 'booking-otp-step',
    path: '/book/al-nour',
    steps: [
      { clickLabelPrefix: 'doctor.choose' },
      { wait: 900 },
      { clickLabelPrefix: 'when.chooseSlot' },
      { wait: 600 },
      { fill: { selector: 'input[name="fullName"]', value: 'أحمد خالد الحسن' } },
      { fill: { selector: 'input[type="tel"]', value: '0931234567' } },
      { clickSubmit: true },
      { wait: 1200 },
    ],
  },
  {
    id: 'booking-details-step',
    path: '/book/al-nour',
    steps: [
      { clickLabelPrefix: 'doctor.choose' },
      { wait: 900 },
      { clickLabelPrefix: 'when.chooseSlot' },
      { wait: 600 },
    ],
  },
];

/** Screens a role may reach, for the viewports they are meaningful at. */
export function screensFor(role, viewportId) {
  return SCREENS.filter(
    (screen) =>
      (screen.anonymous === true || screen.roles.includes(role)) &&
      (screen.viewports === undefined || screen.viewports.includes(viewportId)),
  );
}
