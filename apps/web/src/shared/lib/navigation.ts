import type { IconName } from "@clinic/ui/components/icon";
import type { Can } from "@web/shared/providers/session";

export interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly capabilities?: readonly string[];
  readonly icon: IconName;
  readonly badge?: "pendingBookings";
  readonly also?: readonly string[];
}

export interface NavGroup {
  readonly label?: string | undefined;
  readonly items: readonly NavItem[];
}

export const SETTINGS_VIEW_CAPABILITIES = {
  clinic: ["clinics.update"],
  website: ["website.editor", "website-messages.list"],
  translations: ["translations.list"],
  assistant: ["ai-actions.settings"],
  permissions: ["permissions.list"],
  audit: ["audit.list"],
} as const satisfies Record<string, readonly string[]>;

export const FINANCE_TAB_CAPABILITIES = {
  payroll: "payroll.month",
  profit: "payroll.month",
  expenses: "expenses.list",
} as const;

export const CATALOG_VIEW_CAPABILITIES = {
  prices: ["procedure-catalog.create", "procedure-catalog.update"],
  lists: ["lookups.create"],
} as const satisfies Record<string, readonly string[]>;

export const PAGE_CAPABILITIES = {
  assistant: ["ai.chat"],
  patients: ["patients.list"],
  patientFile: ["patients.findOne"],
  appointments: ["appointments.list"],
  labs: ["labs.list"],
  inventory: ["inventory.list"],
  users: ["users.list"],
  doctor: ["doctors.updateSchedule"],
  payroll: ["payroll.month"],
  payrollRules: ["payroll.payRules"],
  finance: Object.values(FINANCE_TAB_CAPABILITIES),
  myEarnings: ["my-settlement.statement"],
  catalog: Object.values(CATALOG_VIEW_CAPABILITIES).flat(),
  settings: Object.values(SETTINGS_VIEW_CAPABILITIES).flat(),
  settingsMenu: Object.values({
    ...SETTINGS_VIEW_CAPABILITIES,
    website: ["website.editor"],
  }).flat(),
} as const satisfies Record<string, readonly string[]>;

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    items: [
      { to: "/dashboard", label: "nav.dashboard", icon: "activity" },
      {
        to: "/assistant",
        label: "nav.assistant",
        capabilities: PAGE_CAPABILITIES.assistant,
        icon: "sparkles",
      },
    ],
  },
  {
    label: "nav.groups.care",
    items: [
      {
        to: "/patients",
        label: "nav.patients",
        capabilities: PAGE_CAPABILITIES.patients,
        icon: "users",
      },
      {
        to: "/appointments",
        label: "nav.appointments",
        capabilities: PAGE_CAPABILITIES.appointments,
        icon: "calendar",
        badge: "pendingBookings",
      },
      {
        to: "/my-earnings",
        label: "nav.myEarnings",
        capabilities: PAGE_CAPABILITIES.myEarnings,
        icon: "coins",
      },
    ],
  },
  {
    label: "nav.groups.stores",
    items: [
      { to: "/labs", label: "nav.labs", capabilities: PAGE_CAPABILITIES.labs, icon: "clipboard" },
      {
        to: "/inventory",
        label: "nav.inventory",
        capabilities: PAGE_CAPABILITIES.inventory,
        icon: "package",
      },
    ],
  },
];

export const NAV_SETTINGS: NavGroup = {
  label: "nav.settings",
  items: [
    {
      to: "/users",
      label: "nav.users",
      capabilities: PAGE_CAPABILITIES.users,
      icon: "users",
      also: ["/doctors"],
    },
    {
      to: "/finance",
      label: "nav.finance",
      capabilities: PAGE_CAPABILITIES.finance,
      icon: "money",
      also: ["/payroll"],
    },
    {
      to: "/clinic/lists",
      label: "nav.catalog",
      capabilities: PAGE_CAPABILITIES.catalog,
      icon: "list",
    },
    {
      to: "/settings",
      label: "nav.settingsPage",
      capabilities: PAGE_CAPABILITIES.settingsMenu,
      icon: "gear",
    },
  ],
};

export const NAV_ITEMS: readonly NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

export const mayOpen = (capabilities: readonly string[] | undefined, can: Can): boolean =>
  capabilities === undefined || capabilities.some(can);

const visible = (items: readonly NavItem[], can: Can): readonly NavItem[] =>
  items.filter((item) => mayOpen(item.capabilities, can));

export function visibleNavGroups(can: Can | undefined): readonly NavGroup[] {
  if (!can) {
    return [];
  }

  return NAV_GROUPS.map((group) => ({ ...group, items: visible(group.items, can) })).filter(
    (group) => group.items.length > 0,
  );
}

export function visibleSettingsItems(can: Can | undefined): readonly NavItem[] {
  return can ? visible(NAV_SETTINGS.items, can) : [];
}

export const ALL_NAV_ITEMS: readonly NavItem[] = [...NAV_ITEMS, ...NAV_SETTINGS.items];

export function canReachNavItem(to: string, can: Can | undefined): boolean {
  const item = ALL_NAV_ITEMS.find((candidate) => candidate.to === to);

  return can !== undefined && item !== undefined && visible([item], can).length === 1;
}

const WORKSPACE_PREFIXES = ["/assistant"] as const;

export const isWorkspacePath = (pathname: string): boolean =>
  WORKSPACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

export function activeNavItem(pathname: string): NavItem | undefined {
  const under = (prefix: string): boolean =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);
  const depth = (item: NavItem): number =>
    Math.max(...[item.to, ...(item.also ?? [])].filter(under).map((prefix) => prefix.length));

  return ALL_NAV_ITEMS.filter((item) => [item.to, ...(item.also ?? [])].some(under)).reduce<
    NavItem | undefined
  >((best, item) => (best === undefined || depth(item) > depth(best) ? item : best), undefined);
}

const OFF_NAV_TITLES: Readonly<Record<string, string>> = {
  "/login": "auth.loginTitle",
};

export function routeTitle(pathname: string): string | undefined {
  return OFF_NAV_TITLES[pathname] ?? activeNavItem(pathname)?.label;
}

export interface BackTarget {
  readonly to: string;
  readonly label: string;
}

const BACK_ROUTES: readonly (BackTarget & { readonly pattern: RegExp })[] = [
  { pattern: /^\/patients\/[^/]+$/, to: "/patients", label: "nav.patients" },
  { pattern: /^\/labs\/[^/]+$/, to: "/labs?tab=directory", label: "nav.labs" },
  {
    pattern: /^\/inventory\/(?:items\/[^/]+|shopping-list)$/,
    to: "/inventory",
    label: "nav.inventory",
  },
  {
    pattern: /^\/inventory\/suppliers\/[^/]+$/,
    to: "/inventory?tab=suppliers",
    label: "nav.inventory",
  },
  { pattern: /^\/doctors\/[^/]+$/, to: "/users?view=doctors", label: "nav.users" },
  { pattern: /^\/payroll\/[^/]+$/, to: "/finance", label: "nav.finance" },
  { pattern: /^\/profile$/, to: "/dashboard", label: "nav.dashboard" },
];

export function backTarget(pathname: string, can: Can | undefined): BackTarget | undefined {
  const route = BACK_ROUTES.find((candidate) => candidate.pattern.test(pathname));

  if (route === undefined || !canReachNavItem(route.to.split("?")[0] ?? route.to, can)) {
    return undefined;
  }

  return { to: route.to, label: route.label };
}
