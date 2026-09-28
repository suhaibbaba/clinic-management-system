import type { BadgeTone } from "@clinic/ui/components/badge";
import { type LabOrderStatus, LAB_ORDER_STATUS } from "@clinic/shared";

export interface LabStatusStyle {
  readonly tone: BadgeTone;
  readonly label: string;
}

export const style = (tone: BadgeTone, label: string): LabStatusStyle => ({ tone, label });

export const LAB_ORDER_STATUS_STYLES: Record<LabOrderStatus, LabStatusStyle> = {
  [LAB_ORDER_STATUS.DRAFT]: style("neutral", "labs.status.draft"),
  [LAB_ORDER_STATUS.SENT]: style("info", "labs.status.sent"),
  [LAB_ORDER_STATUS.READY]: style("warning", "labs.status.ready"),
  [LAB_ORDER_STATUS.RECEIVED]: style("success", "labs.status.received"),
  [LAB_ORDER_STATUS.FITTED]: style("neutral", "labs.status.fitted"),
  [LAB_ORDER_STATUS.RETURNED]: style("danger", "labs.status.returned"),
  [LAB_ORDER_STATUS.CANCELLED]: style("neutral", "labs.status.cancelled"),
};
