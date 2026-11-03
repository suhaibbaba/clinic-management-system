import {
  DASHBOARD_GRID_COLUMNS,
  DASHBOARD_KEY_NUMBER,
  DASHBOARD_KEY_NUMBER_REQUIRES,
  DASHBOARD_KEY_NUMBERS,
  DASHBOARD_QUICK_ACTION,
  DASHBOARD_QUICK_ACTION_REQUIRES,
  DASHBOARD_WIDGET,
  DASHBOARD_WIDGET_IDS,
  DASHBOARD_WIDGETS,
  DASHBOARD_WIDTH,
  DASHBOARD_WIDTH_COLUMNS,
  DASHBOARD_ZONE,
  type DashboardKeyNumber,
  type DashboardQuickAction,
  type DashboardWidgetId,
  type DashboardWidth,
  type DashboardZone,
} from "@shared/constants/dashboard";
import type { DashboardLayout, DashboardWidgetPlacement } from "@shared/schemas/dashboard";

export type DashboardAllows = (capability: string) => boolean;

const place = (
  id: DashboardWidgetId,
  zone: DashboardZone,
  width: DashboardWidth = DASHBOARD_WIDTH.FULL,
  visible = true,
): DashboardWidgetPlacement => ({ id, zone, width, visible });

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  widgets: [
    place(DASHBOARD_WIDGET.GREETING, DASHBOARD_ZONE.TOP),
    place(DASHBOARD_WIDGET.KEY_NUMBERS, DASHBOARD_ZONE.MAIN),
    place(DASHBOARD_WIDGET.SCHEDULE, DASHBOARD_ZONE.MAIN),
    place(DASHBOARD_WIDGET.VISITS_TODAY, DASHBOARD_ZONE.MAIN),
    place(DASHBOARD_WIDGET.COLLECTIONS, DASHBOARD_ZONE.MAIN, DASHBOARD_WIDTH.FULL, false),
    place(DASHBOARD_WIDGET.QUICK_ACTIONS, DASHBOARD_ZONE.SIDE),
    place(DASHBOARD_WIDGET.CALENDAR, DASHBOARD_ZONE.SIDE),
    place(DASHBOARD_WIDGET.TOP_DEBTS, DASHBOARD_ZONE.SIDE),
    place(DASHBOARD_WIDGET.NEW_PATIENTS, DASHBOARD_ZONE.SIDE, DASHBOARD_WIDTH.FULL, false),
    place(DASHBOARD_WIDGET.NOTES, DASHBOARD_ZONE.SIDE),
  ],
  keyNumbers: [
    DASHBOARD_KEY_NUMBER.APPOINTMENTS_TODAY,
    DASHBOARD_KEY_NUMBER.PENDING_BOOKINGS,
    DASHBOARD_KEY_NUMBER.VISITS_TODAY,
    DASHBOARD_KEY_NUMBER.COLLECTED_TODAY,
    DASHBOARD_KEY_NUMBER.OVERDUE,
  ],
  quickActions: [
    DASHBOARD_QUICK_ACTION.PATIENT,
    DASHBOARD_QUICK_ACTION.APPOINTMENT,
    DASHBOARD_QUICK_ACTION.VISIT,
    DASHBOARD_QUICK_ACTION.PAYMENT,
  ],
};

export const keyNumberAvailable = (key: DashboardKeyNumber, allows: DashboardAllows): boolean =>
  DASHBOARD_KEY_NUMBER_REQUIRES[key].every(allows);

export const quickActionAvailable = (
  action: DashboardQuickAction,
  allows: DashboardAllows,
): boolean => allows(DASHBOARD_QUICK_ACTION_REQUIRES[action]);

export const dashboardWidgetAvailable = (
  id: DashboardWidgetId,
  allows: DashboardAllows,
): boolean => {
  const definition = DASHBOARD_WIDGETS[id];

  if (!definition.requires.every(allows)) {
    return false;
  }

  if (definition.requiresAny !== undefined && !definition.requiresAny.some(allows)) {
    return false;
  }

  return (
    id !== DASHBOARD_WIDGET.KEY_NUMBERS ||
    DASHBOARD_KEY_NUMBERS.some((key) => keyNumberAvailable(key, allows))
  );
};

const placed = (widget: DashboardWidgetPlacement): DashboardWidgetPlacement => {
  const zones = DASHBOARD_WIDGETS[widget.id].zones;
  const zone = zones.includes(widget.zone) ? widget.zone : zones[0]!;

  return {
    id: widget.id,
    zone,
    width: zone === DASHBOARD_ZONE.MAIN ? widget.width : DASHBOARD_WIDTH.FULL,
    visible: widget.visible,
  };
};

export function normalizeDashboardLayout(
  layout: DashboardLayout,
  allows: DashboardAllows,
): DashboardLayout {
  const seen = new Set<DashboardWidgetId>();
  const widgets: DashboardWidgetPlacement[] = [];

  const take = (widget: DashboardWidgetPlacement): void => {
    if (seen.has(widget.id) || !dashboardWidgetAvailable(widget.id, allows)) {
      return;
    }

    seen.add(widget.id);
    widgets.push(placed(widget));
  };

  layout.widgets.forEach(take);
  DEFAULT_DASHBOARD_LAYOUT.widgets.forEach(take);

  for (const id of DASHBOARD_WIDGET_IDS) {
    take({
      id,
      zone: DASHBOARD_WIDGETS[id].zones[0]!,
      width: DASHBOARD_WIDTH.FULL,
      visible: false,
    });
  }

  const keyNumbers = [...new Set(layout.keyNumbers)].filter((key) =>
    keyNumberAvailable(key, allows),
  );

  const quickActions = [
    ...new Set(layout.quickActions ?? DEFAULT_DASHBOARD_LAYOUT.quickActions ?? []),
  ].filter((action) => quickActionAvailable(action, allows));

  return { widgets, keyNumbers, quickActions };
}

export function dashboardRowSpans(widths: readonly DashboardWidth[]): number[] {
  const spans = widths.map((width) => DASHBOARD_WIDTH_COLUMNS[width]);
  let used = 0;

  spans.forEach((span, index) => {
    if (used + span > DASHBOARD_GRID_COLUMNS) {
      spans[index - 1]! += DASHBOARD_GRID_COLUMNS - used;
      used = 0;
    }

    used += span;
  });

  if (spans.length > 0 && used < DASHBOARD_GRID_COLUMNS) {
    spans[spans.length - 1]! += DASHBOARD_GRID_COLUMNS - used;
  }

  return spans;
}

export const sameDashboardLayout = (a: DashboardLayout, b: DashboardLayout): boolean =>
  JSON.stringify(a) === JSON.stringify(b);
