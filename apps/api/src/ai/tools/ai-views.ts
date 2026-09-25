import type {
  AiTableView,
  AiView,
  AiViewColumn,
  AiViewColumnKind,
  CalendarAppointment,
  InventoryItemRow,
  LabOrderRow,
  TimelineEntry,
} from "@clinic/shared";

// The page's side of each read tool: columns name i18n keys, cells carry raw values, and the page
// formats money, dates and names. Nothing here is a sentence in any language.

const column = (key: string, kind: AiViewColumnKind, prefix?: string): AiViewColumn => ({
  key,
  label: `assistant.view.columns.${key}`,
  kind,
  ...(prefix && { prefix }),
});

const link = (href: string, label: string) => ({ href, label });

interface Capped<TItem> {
  readonly items: TItem[];
  readonly total?: number;
  readonly truncated: boolean;
}

const table = (
  columns: AiViewColumn[],
  rows: Record<string, unknown>[],
  list: { truncated: boolean; total?: number },
  href?: string,
): AiTableView => ({
  type: "table",
  columns,
  rows,
  truncated: list.truncated,
  ...(list.total !== undefined && { total: list.total }),
  ...(href && { href }),
});

export function appointmentsView(
  list: Capped<CalendarAppointment>,
  filters: { from: string; to: string; doctorId?: string | undefined },
): AiView {
  const query = new URLSearchParams({
    view: filters.from === filters.to ? "day" : "week",
    date: filters.from,
    ...(filters.doctorId && { doctor: filters.doctorId }),
  });

  return table(
    [
      column("date", "date"),
      column("time", "time"),
      column("patient", "link"),
      column("doctor", "person"),
      column("status", "status"),
    ],
    list.items.map((appointment) => ({
      id: appointment.id,
      date: appointment.startsAt,
      time: appointment.startsAt,
      patient: link(`/patients/${appointment.patientId}`, appointment.patientName),
      doctor: appointment.doctorName,
      status: appointment.status,
    })),
    list,
    `/appointments?${query.toString()}`,
  );
}

export function patientsView(
  list: Capped<{
    id: string;
    fileNumber: string;
    fullName: string;
    phone: string;
    lastVisitAt: string | null;
  }>,
  search: string,
): AiView {
  return table(
    [
      column("fileNumber", "text"),
      column("patient", "link"),
      column("phone", "text"),
      column("lastVisit", "date"),
    ],
    list.items.map((patient) => ({
      id: patient.id,
      fileNumber: patient.fileNumber,
      patient: link(`/patients/${patient.id}`, patient.fullName),
      phone: patient.phone,
      lastVisit: patient.lastVisitAt,
    })),
    list,
    `/patients?${new URLSearchParams({ q: search }).toString()}`,
  );
}

export function patientView(
  patient: { id: string; fullName: string; fileNumber: string; phone: string },
  balance: string | undefined,
  history: Capped<TimelineEntry>,
): AiView {
  return {
    type: "patient",
    patient,
    ...(balance !== undefined && { balance }),
    table: table(
      [
        column("date", "date"),
        column("entry", "code", "patients.timeline.types"),
        column("title", "text"),
      ],
      history.items.map((entry) => ({
        id: entry.id,
        date: entry.occurredAt,
        entry: entry.type,
        title: entry.title,
      })),
      history,
      `/patients/${patient.id}?tab=timeline`,
    ),
  };
}

export function dailyStatsView(counts: {
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
}): AiView {
  return {
    type: "stats",
    tiles: (["total", "completed", "cancelled", "noShow"] as const).map((key) => ({
      label: `assistant.view.stats.${key}`,
      value: String(counts[key]),
      kind: "number",
    })),
  };
}

export function financialView(summary: {
  charged: string;
  collected: string;
  outstandingTotal: string;
  topDebtors: {
    patientId: string;
    fullName: string;
    balance: string;
    daysSinceLastPayment: number | null;
  }[];
}): AiView {
  return {
    type: "stats",
    tiles: [
      { label: "assistant.view.stats.charged", value: summary.charged, kind: "money" },
      { label: "assistant.view.stats.collected", value: summary.collected, kind: "money" },
      { label: "assistant.view.stats.outstanding", value: summary.outstandingTotal, kind: "money" },
    ],
    table: table(
      [
        column("patient", "link"),
        column("balance", "money"),
        column("daysSinceLastPayment", "number"),
      ],
      summary.topDebtors.map((debtor) => ({
        id: debtor.patientId,
        patient: link(`/patients/${debtor.patientId}?tab=billing`, debtor.fullName),
        balance: debtor.balance,
        daysSinceLastPayment: debtor.daysSinceLastPayment,
      })),
      { truncated: false },
      "/billing/overdue",
    ),
  };
}

export function labOrdersView(list: Capped<LabOrderRow>): AiView {
  return {
    type: "list",
    items: list.items.map((order) => ({
      title: order.patientName,
      subtitle: [order.labName, order.workTypeName].filter(Boolean).join(" · "),
      ...(order.expectedAt && { date: order.expectedAt }),
      href: `/labs/${order.id}`,
    })),
    truncated: list.truncated,
    ...(list.total !== undefined && { total: list.total }),
    href: "/labs",
  };
}

export function lowStockView(list: Capped<InventoryItemRow>): AiView {
  return {
    type: "list",
    items: list.items.map((item) => ({
      title: item.name,
      subtitle: `${item.quantity} / ${item.minQuantity}`,
    })),
    truncated: list.truncated,
    ...(list.total !== undefined && { total: list.total }),
    href: "/inventory",
  };
}
