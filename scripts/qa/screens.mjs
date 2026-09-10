// One list, shared with `tests/e2e/smoke.spec.ts`, so a screen is added once. Entries name the
// roles that may reach it, and `steps` are data so the same entry runs in both languages.

export const ROLES = /** @type {const} */ (['admin', 'doctor', 'receptionist', 'technician']);

/** The seeded development accounts (apps/api/src/database/seed.ts). */
export const SEED_ACCOUNTS = {
  admin: { identifier: 'admin@clinic.local', password: 'ChangeMe123!' },
  doctor: { identifier: 'doctor@clinic.local', password: 'ChangeMe123!' },
  receptionist: { identifier: 'reception@clinic.local', password: 'ChangeMe123!' },
  technician: { identifier: 'technician@clinic.local', password: 'ChangeMe123!' },
};

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

// Steps as data: `click`, `clickTab`, `clickRadio`, `clickSelector`, `clickLabelPrefix` by i18n
// key; `firstRow` opens a list's first row; `wait` is milliseconds.
export const SCREENS = [
  { id: 'login', path: '/login', roles: ALL, anonymous: true },

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
  // The file's tabs are addresses, so they are swept as addresses — a screen with `steps` is left
  // out of the CI run, and as URLs each tab is asserted per role.
  { id: 'patient-file-visits', path: '/patients/:patientId?tab=visits', roles: CLINICAL },
  {
    id: 'patient-file-plans',
    path: '/patients/:patientId?tab=treatmentPlans',
    roles: CLINICAL,
  },
  {
    id: 'patient-file-attachments',
    path: '/patients/:patientId?tab=attachments',
    roles: CLINICAL,
  },
  { id: 'patient-file-timeline', path: '/patients/:patientId?tab=timeline', roles: CLINICAL },
  { id: 'patient-file-billing', path: '/patients/:patientId?tab=billing', roles: FRONT_DESK },
  {
    // The plan list filtered to one status — its own parameter, because the
    // tab strip already owns `tab`.
    id: 'patient-file-plans-accepted',
    path: '/patients/:patientId?tab=treatmentPlans&plan=accepted',
    roles: CLINICAL,
  },
  {
    id: 'patient-file-long-name',
    path: '/patients/:longNamePatientId',
    roles: CLINICAL,
  },

  { id: 'appointments', path: '/appointments', roles: FRONT_DESK },
  {
    // `?view=day`: on a phone the toggle is not drawn, so this is swept at the two wider shapes
    // only.
    id: 'appointments-day',
    path: '/appointments?view=day',
    roles: FRONT_DESK,
    viewports: ['tablet', 'desktop'],
  },
  {
    id: 'appointments-day-one-doctor',
    path: '/appointments?view=day&doctor=:doctorId',
    roles: FRONT_DESK,
    viewports: ['tablet', 'desktop'],
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
    // Not `LABS`: a technician cannot raise an order, so there was no button for the step and the
    // sweep filed the board under the modal's name.
    roles: CLINICAL,
    steps: [{ click: 'labs.orders.add' }, { wait: 500 }],
  },
  { id: 'lab-page', path: '/labs/:labId', roles: LABS },
  { id: 'lab-page-statement', path: '/labs/:labId?tab=statement', roles: LABS },

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

  { id: 'clinic', path: '/clinic', roles: ADMIN },
  {
    // A day open: the collapsed summaries are what the screen is for, and the expanded panel is
    // where the split shift and the copy action live.
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

  {
    id: 'chrome-user-menu',
    path: '/dashboard',
    roles: ALL,
    viewports: ['tablet', 'desktop'],
    steps: [{ clickSelector: '[aria-haspopup="menu"]:visible' }, { wait: 400 }],
  },
  {
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

/** No account, so it is swept once per language and viewport rather than once per role. */
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

export function screensFor(role, viewportId) {
  return SCREENS.filter(
    (screen) =>
      (screen.anonymous === true || screen.roles.includes(role)) &&
      (screen.viewports === undefined || screen.viewports.includes(viewportId)),
  );
}
