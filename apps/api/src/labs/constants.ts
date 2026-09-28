import { LAB_ORDER_STAGES, LAB_ORDER_STAGE_STATUSES } from "@clinic/shared";

export const LAB_ORDERS_ENTITY = "lab_orders";

export const OPEN_STATUSES = LAB_ORDER_STAGES.flatMap((stage) => [
  ...LAB_ORDER_STAGE_STATUSES[stage],
]);

export const LAB_PAYMENTS_ENTITY = "lab_payments";

export const LAB_WORK_TYPES_ENTITY = "lab_work_types";

export const LABS_ENTITY = "labs";
