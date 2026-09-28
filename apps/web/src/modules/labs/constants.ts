import type { LabOrderSort, LabOrderView } from "@clinic/shared";
import type { IconName } from "@clinic/ui";

export interface LabOrderField {
  readonly icon: IconName;
  readonly label: string;
}

export const LAB_ORDER_FIELDS = {
  work: { icon: "clipboard", label: "labs.orders.columns.work" },
  patient: { icon: "user", label: "labs.order.patient" },
  teeth: { icon: "tooth", label: "labs.order.teeth" },
  lab: { icon: "building", label: "labs.order.lab" },
  status: { icon: "activity", label: "labs.orders.columns.status" },
  expected: { icon: "calendar", label: "labs.order.expected" },
  price: { icon: "coins", label: "labs.order.price" },
} as const satisfies Record<string, LabOrderField>;

export interface LabOrderSortOption {
  readonly sort: LabOrderSort;
  readonly dir: "asc" | "desc";
  readonly label: string;
}

export const LAB_ORDER_SORT_OPTIONS: Record<LabOrderView, readonly LabOrderSortOption[]> = {
  open: [
    { sort: "due", dir: "asc", label: "labs.orders.sort.dueAsc" },
    { sort: "due", dir: "desc", label: "labs.orders.sort.dueDesc" },
    { sort: "sent", dir: "desc", label: "labs.orders.sort.sentDesc" },
    { sort: "patient", dir: "asc", label: "labs.orders.sort.patientAsc" },
    { sort: "lab", dir: "asc", label: "labs.orders.sort.labAsc" },
  ],
  done: [
    { sort: "finished", dir: "desc", label: "labs.orders.sort.finishedDesc" },
    { sort: "finished", dir: "asc", label: "labs.orders.sort.finishedAsc" },
    { sort: "patient", dir: "asc", label: "labs.orders.sort.patientAsc" },
    { sort: "lab", dir: "asc", label: "labs.orders.sort.labAsc" },
  ],
};

export const LAB_PAGE_TABS = ["orders", "prices", "statement"] as const;

export const LABS_TAB_ORDERS = "orders";

export const LABS_TAB_DONE = "done";

export const LABS_TAB_DIRECTORY = "directory";
