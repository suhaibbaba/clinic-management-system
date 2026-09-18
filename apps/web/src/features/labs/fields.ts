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
