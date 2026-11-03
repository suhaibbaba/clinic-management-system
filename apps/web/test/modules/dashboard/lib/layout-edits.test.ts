import {
  DASHBOARD_KEY_NUMBER,
  DASHBOARD_WIDGET,
  DASHBOARD_WIDTH,
  DASHBOARD_ZONE,
  DEFAULT_DASHBOARD_LAYOUT,
  RULE,
  dashboardRowSpans,
  normalizeDashboardLayout,
  type DashboardLayout,
} from "@clinic/shared";
import { describe, expect, it } from "vitest";
import {
  changeWidget,
  moveWidget,
  placeWidget,
  shownIn,
  stepWidget,
  standardLayoutFor,
  toggleKeyNumber,
} from "@web/modules/dashboard/lib/layout-edits";

const everything = (): boolean => true;
const coreOnly = (capability: string): boolean =>
  capability === RULE.OVERDUE_WIDGET || capability === "notes.list";

const ids = (layout: DashboardLayout, zone: (typeof DASHBOARD_ZONE)[keyof typeof DASHBOARD_ZONE]) =>
  shownIn(layout, zone).map((widget) => widget.id);

describe("normalizing a saved dashboard", () => {
  it("drops what the role may not see and the key numbers it lost", () => {
    const layout = normalizeDashboardLayout(DEFAULT_DASHBOARD_LAYOUT, coreOnly);

    expect(layout.widgets.map((widget) => widget.id)).toEqual([
      DASHBOARD_WIDGET.GREETING,
      DASHBOARD_WIDGET.KEY_NUMBERS,
      DASHBOARD_WIDGET.NOTES,
    ]);
    expect(layout.keyNumbers).toEqual([DASHBOARD_KEY_NUMBER.OVERDUE]);
  });

  it("brings back a widget the saved layout never mentioned", () => {
    const layout = normalizeDashboardLayout({ widgets: [], keyNumbers: [] }, everything);

    expect(ids(layout, DASHBOARD_ZONE.SIDE)).toEqual([
      DASHBOARD_WIDGET.QUICK_ACTIONS,
      DASHBOARD_WIDGET.CALENDAR,
      DASHBOARD_WIDGET.TOP_DEBTS,
      DASHBOARD_WIDGET.NOTES,
    ]);
  });

  it("moves a widget out of a zone it may not sit in and keeps the side and top full width", () => {
    const layout = normalizeDashboardLayout(
      {
        widgets: [
          {
            id: DASHBOARD_WIDGET.SCHEDULE,
            zone: DASHBOARD_ZONE.SIDE,
            width: DASHBOARD_WIDTH.HALF,
            visible: true,
          },
          {
            id: DASHBOARD_WIDGET.NOTES,
            zone: DASHBOARD_ZONE.SIDE,
            width: DASHBOARD_WIDTH.THIRD,
            visible: true,
          },
        ],
        keyNumbers: [DASHBOARD_KEY_NUMBER.OVERDUE, DASHBOARD_KEY_NUMBER.OVERDUE],
      },
      everything,
    );

    expect(layout.widgets.slice(0, 2)).toEqual([
      {
        id: DASHBOARD_WIDGET.SCHEDULE,
        zone: DASHBOARD_ZONE.MAIN,
        width: DASHBOARD_WIDTH.HALF,
        visible: true,
      },
      {
        id: DASHBOARD_WIDGET.NOTES,
        zone: DASHBOARD_ZONE.SIDE,
        width: DASHBOARD_WIDTH.FULL,
        visible: true,
      },
    ]);
    expect(layout.keyNumbers).toEqual([DASHBOARD_KEY_NUMBER.OVERDUE]);
  });
});

describe("the main zone's rows", () => {
  it("widens the last widget of a row that is not full", () => {
    expect(
      dashboardRowSpans([
        DASHBOARD_WIDTH.TWO_THIRDS,
        DASHBOARD_WIDTH.HALF,
        DASHBOARD_WIDTH.THIRD,
        DASHBOARD_WIDTH.THIRD,
      ]),
    ).toEqual([6, 3, 3, 6]);
  });

  it("leaves rows that are already full alone", () => {
    expect(
      dashboardRowSpans([DASHBOARD_WIDTH.THIRD, DASHBOARD_WIDTH.TWO_THIRDS, DASHBOARD_WIDTH.FULL]),
    ).toEqual([2, 4, 6]);
  });
});

describe("editing a draft layout", () => {
  const draft = normalizeDashboardLayout(DEFAULT_DASHBOARD_LAYOUT, everything);

  it("moves a widget past its neighbour in the same zone only", () => {
    const moved = moveWidget(draft, DASHBOARD_WIDGET.NOTES, -1);

    expect(ids(moved, DASHBOARD_ZONE.SIDE)).toEqual([
      DASHBOARD_WIDGET.QUICK_ACTIONS,
      DASHBOARD_WIDGET.CALENDAR,
      DASHBOARD_WIDGET.NOTES,
      DASHBOARD_WIDGET.TOP_DEBTS,
    ]);
    expect(ids(moved, DASHBOARD_ZONE.MAIN)).toEqual(ids(draft, DASHBOARD_ZONE.MAIN));
    expect(moveWidget(draft, DASHBOARD_WIDGET.QUICK_ACTIONS, -1)).toBe(draft);
  });

  it("hides a widget and moves it to another zone", () => {
    const hidden = changeWidget(draft, DASHBOARD_WIDGET.CALENDAR, { visible: false });
    const moved = changeWidget(draft, DASHBOARD_WIDGET.NOTES, { zone: DASHBOARD_ZONE.MAIN });

    expect(ids(hidden, DASHBOARD_ZONE.SIDE)).toEqual([
      DASHBOARD_WIDGET.QUICK_ACTIONS,
      DASHBOARD_WIDGET.TOP_DEBTS,
      DASHBOARD_WIDGET.NOTES,
    ]);
    expect(ids(moved, DASHBOARD_ZONE.MAIN)).toContain(DASHBOARD_WIDGET.NOTES);
  });

  it("adds a key number at the end and removes it again", () => {
    const without = toggleKeyNumber(draft, DASHBOARD_KEY_NUMBER.APPOINTMENTS_TODAY);

    const rest = [
      DASHBOARD_KEY_NUMBER.PENDING_BOOKINGS,
      DASHBOARD_KEY_NUMBER.VISITS_TODAY,
      DASHBOARD_KEY_NUMBER.COLLECTED_TODAY,
      DASHBOARD_KEY_NUMBER.OVERDUE,
    ];

    expect(without.keyNumbers).toEqual(rest);
    expect(toggleKeyNumber(without, DASHBOARD_KEY_NUMBER.APPOINTMENTS_TODAY).keyNumbers).toEqual([
      ...rest,
      DASHBOARD_KEY_NUMBER.APPOINTMENTS_TODAY,
    ]);
  });

  it("hides a widget no saved layout has seen when the default keeps it hidden", () => {
    expect(
      draft.widgets.find((widget) => widget.id === DASHBOARD_WIDGET.COLLECTIONS)?.visible,
    ).toBe(false);
  });

  it("restores the standard layout with only what the role may see", () => {
    const changed = changeWidget(
      moveWidget(draft, DASHBOARD_WIDGET.NOTES, -1),
      DASHBOARD_WIDGET.GREETING,
      { visible: false },
    );
    const restored = standardLayoutFor(changed, DEFAULT_DASHBOARD_LAYOUT, [
      DASHBOARD_KEY_NUMBER.OVERDUE,
    ]);

    expect(restored.widgets).toEqual(DEFAULT_DASHBOARD_LAYOUT.widgets);
    expect(restored.keyNumbers).toEqual([DASHBOARD_KEY_NUMBER.OVERDUE]);
  });

  it("drops a widget before another in a different zone and widens nothing in the side", () => {
    const moved = placeWidget(
      draft,
      DASHBOARD_WIDGET.NOTES,
      DASHBOARD_ZONE.MAIN,
      DASHBOARD_WIDGET.SCHEDULE,
    );

    expect(ids(moved, DASHBOARD_ZONE.MAIN).slice(0, 2)).toEqual([
      DASHBOARD_WIDGET.KEY_NUMBERS,
      DASHBOARD_WIDGET.NOTES,
    ]);
    expect(ids(moved, DASHBOARD_ZONE.SIDE)).not.toContain(DASHBOARD_WIDGET.NOTES);
    expect(placeWidget(draft, DASHBOARD_WIDGET.SCHEDULE, DASHBOARD_ZONE.SIDE, null)).toBe(draft);
  });

  it("steps a widget past the edge of its zone into the next one it may sit in", () => {
    const intoSide = stepWidget(draft, DASHBOARD_WIDGET.VISITS_TODAY, 1);
    const intoTop = stepWidget(draft, DASHBOARD_WIDGET.KEY_NUMBERS, -1);

    expect(ids(intoSide, DASHBOARD_ZONE.MAIN)).toContain(DASHBOARD_WIDGET.VISITS_TODAY);
    expect(ids(intoTop, DASHBOARD_ZONE.TOP)).toEqual([
      DASHBOARD_WIDGET.GREETING,
      DASHBOARD_WIDGET.KEY_NUMBERS,
    ]);
    expect(
      ids(stepWidget(draft, DASHBOARD_WIDGET.QUICK_ACTIONS, -1), DASHBOARD_ZONE.MAIN).at(-1),
    ).toBe(DASHBOARD_WIDGET.QUICK_ACTIONS);
  });
});
