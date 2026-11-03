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
