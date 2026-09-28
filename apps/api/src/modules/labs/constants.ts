import { LAB_ORDER_STAGES, LAB_ORDER_STAGE_STATUSES } from "@clinic/shared";

export const OPEN_STATUSES = LAB_ORDER_STAGES.flatMap((stage) => [
  ...LAB_ORDER_STAGE_STATUSES[stage],
]);
