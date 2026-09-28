import {
  LAB_ORDER_STAGE,
  LAB_ORDER_STATUS,
  canTransitionLabOrder,
  type LabOrderStage,
  type LabOrderStatus,
} from "@clinic/shared";
import type { BadgeTone } from "@clinic/ui/components/badge";
import type { Can } from "@web/shared/providers/session";
import type { LabOrderStep } from "@web/modules/labs/queries";

export const LAB_ORDER_STAGE_TONES: Record<LabOrderStage, BadgeTone> = {
  [LAB_ORDER_STAGE.TO_SEND]: "neutral",
  [LAB_ORDER_STAGE.AT_LAB]: "info",
  [LAB_ORDER_STAGE.READY]: "warning",
  [LAB_ORDER_STAGE.TO_FIT]: "success",
};

interface StepDefinition {
  readonly step: LabOrderStep;
  readonly to: LabOrderStatus;
  readonly label: string;
  readonly capability: string;
}

const STEPS: readonly StepDefinition[] = [
  {
    step: "send",
    to: LAB_ORDER_STATUS.SENT,
    label: "labs.actions.send",
    capability: "lab-orders.send",
  },
  {
    step: "ready",
    to: LAB_ORDER_STATUS.READY,
    label: "labs.actions.ready",
    capability: "lab-orders.ready",
  },
  {
    step: "receive",
    to: LAB_ORDER_STATUS.RECEIVED,
    label: "labs.actions.receive",
    capability: "lab-orders.receive",
  },
  {
    step: "fit",
    to: LAB_ORDER_STATUS.FITTED,
    label: "labs.actions.fit",
    capability: "lab-orders.fit",
  },
  {
    step: "cancel",
    to: LAB_ORDER_STATUS.CANCELLED,
    label: "labs.actions.cancel",
    capability: "lab-orders.cancel",
  },
];

export function availableSteps(status: LabOrderStatus, can: Can): readonly StepDefinition[] {
  return STEPS.filter((step) => canTransitionLabOrder(status, step.to) && can(step.capability));
}

export function canReturn(status: LabOrderStatus, can: Can): boolean {
  return canTransitionLabOrder(status, LAB_ORDER_STATUS.RETURNED) && can("lab-orders.return");
}
