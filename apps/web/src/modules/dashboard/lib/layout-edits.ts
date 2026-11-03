import {
  DASHBOARD_WIDGETS,
  DASHBOARD_WIDTH,
  DASHBOARD_ZONE,
  DASHBOARD_ZONES,
} from "@clinic/shared";
import type {
  DashboardKeyNumber,
  DashboardLayout,
  DashboardWidgetId,
  DashboardWidgetPlacement,
  DashboardZone,
} from "@clinic/shared";

export type WidgetChange = Partial<Pick<DashboardWidgetPlacement, "zone" | "width" | "visible">>;

export const shownIn = (layout: DashboardLayout, zone: DashboardZone): DashboardWidgetPlacement[] =>
  layout.widgets.filter((widget) => widget.visible && widget.zone === zone);

export const hiddenWidgets = (layout: DashboardLayout): DashboardWidgetPlacement[] =>
  layout.widgets.filter((widget) => !widget.visible);

export function changeWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  change: WidgetChange,
): DashboardLayout {
  return {
    ...layout,
    widgets: layout.widgets.map((widget) => (widget.id === id ? { ...widget, ...change } : widget)),
  };
}

export function moveWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  step: -1 | 1,
): DashboardLayout {
  const target = layout.widgets.find((widget) => widget.id === id);

  if (!target) {
    return layout;
  }

  const zone = shownIn(layout, target.zone);
  const neighbour = zone[zone.indexOf(target) + step];

  if (!neighbour) {
    return layout;
  }

  const widgets = [...layout.widgets];
  const from = widgets.indexOf(target);
  const to = widgets.indexOf(neighbour);

  widgets[from] = neighbour;
  widgets[to] = target;

  return { ...layout, widgets };
}

export function toggleKeyNumber(layout: DashboardLayout, key: DashboardKeyNumber): DashboardLayout {
  return {
    ...layout,
    keyNumbers: layout.keyNumbers.includes(key)
      ? layout.keyNumbers.filter((shown) => shown !== key)
      : [...layout.keyNumbers, key],
  };
}

export function standardLayoutFor(
  current: DashboardLayout,
  standard: DashboardLayout,
  keyOptions: readonly DashboardKeyNumber[],
): DashboardLayout {
  const available = new Set(current.widgets.map((widget) => widget.id));
  const fromStandard = standard.widgets.filter((widget) => available.has(widget.id));
  const placed = new Set(fromStandard.map((widget) => widget.id));

  return {
    widgets: [
      ...fromStandard,
      ...current.widgets
        .filter((widget) => !placed.has(widget.id))
        .map((widget) => ({ ...widget, visible: false })),
    ],
    keyNumbers: standard.keyNumbers.filter((key) => keyOptions.includes(key)),
  };
}

export const fitsZone = (id: DashboardWidgetId, zone: DashboardZone): boolean =>
  DASHBOARD_WIDGETS[id].zones.includes(zone);

export function placeWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  zone: DashboardZone,
  beforeId: DashboardWidgetId | null,
): DashboardLayout {
  const moving = layout.widgets.find((widget) => widget.id === id);

  if (!moving || !fitsZone(id, zone) || beforeId === id) {
    return layout;
  }

  const placed: DashboardWidgetPlacement = {
    ...moving,
    zone,
    width: zone === DASHBOARD_ZONE.MAIN ? moving.width : DASHBOARD_WIDTH.FULL,
  };
  const rest = layout.widgets.filter((widget) => widget.id !== id);
  const lastInZone = rest.findLastIndex((widget) => widget.visible && widget.zone === zone);
  const at =
    beforeId === null
      ? lastInZone === -1
        ? rest.length
        : lastInZone + 1
      : rest.findIndex((widget) => widget.id === beforeId);

  if (at === -1) {
    return layout;
  }

  return { ...layout, widgets: [...rest.slice(0, at), placed, ...rest.slice(at)] };
}

export function stepWidget(
  layout: DashboardLayout,
  id: DashboardWidgetId,
  step: -1 | 1,
): DashboardLayout {
  const target = layout.widgets.find((widget) => widget.id === id);

  if (!target) {
    return layout;
  }

  const zone = shownIn(layout, target.zone);
  const index = zone.indexOf(target);

  if (zone[index + step]) {
    return moveWidget(layout, id, step);
  }

  const zones = DASHBOARD_ZONES.filter((candidate) => fitsZone(id, candidate));
  const next = zones[zones.indexOf(target.zone) + step];

  if (next === undefined) {
    return layout;
  }

  const neighbours = shownIn(layout, next);

  return placeWidget(layout, id, next, step === 1 ? (neighbours[0]?.id ?? null) : null);
}
