import {
  LAB_ORDER_STAGE,
  LAB_ORDER_STATUS,
  canTransitionLabOrder,
  type LabOrderStage,
  type LabOrderStatus,
} from "@clinic/shared";
import type { BadgeTone } from "@clinic/ui/components/badge";
import type { Can } from "@web/features/auth/session";
import type { LabOrderStep } from "@web/features/labs/queries";

// The badge everywhere reads this, so a status cannot be amber in one place and grey in another.
export interface LabStatusStyle {
  readonly tone: BadgeTone;
  readonly label: string;
}

const style = (tone: BadgeTone, label: string): LabStatusStyle => ({ tone, label });

export const LAB_ORDER_STAGE_TONES: Record<LabOrderStage, BadgeTone> = {
  [LAB_ORDER_STAGE.TO_SEND]: "neutral",
  [LAB_ORDER_STAGE.AT_LAB]: "info",
  [LAB_ORDER_STAGE.READY]: "warning",
  [LAB_ORDER_STAGE.TO_FIT]: "success",
};

export const LAB_ORDER_STATUS_STYLES: Record<LabOrderStatus, LabStatusStyle> = {
  [LAB_ORDER_STATUS.DRAFT]: style("neutral", "labs.status.draft"),
  [LAB_ORDER_STATUS.SENT]: style("info", "labs.status.sent"),
  [LAB_ORDER_STATUS.READY]: style("warning", "labs.status.ready"),
  [LAB_ORDER_STATUS.RECEIVED]: style("success", "labs.status.received"),
  [LAB_ORDER_STATUS.FITTED]: style("neutral", "labs.status.fitted"),
  [LAB_ORDER_STATUS.RETURNED]: style("danger", "labs.status.returned"),
  [LAB_ORDER_STATUS.CANCELLED]: style("neutral", "labs.status.cancelled"),
};

interface StepDefinition {
  readonly step: LabOrderStep;
  readonly to: LabOrderStatus;
  readonly label: string;
  /** The permission the API asks for on this move. */
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

// Two filters: the transition table decides what is possible, the clinic's permissions who may do
// it. Cosmetic — the API refuses either way.
export function availableSteps(status: LabOrderStatus, can: Can): readonly StepDefinition[] {
  return STEPS.filter((step) => canTransitionLabOrder(status, step.to) && can(step.capability));
}

/** Returning is its own action: it needs a reason, so it opens a dialog. */
export function canReturn(status: LabOrderStatus, can: Can): boolean {
  return canTransitionLabOrder(status, LAB_ORDER_STATUS.RETURNED) && can("lab-orders.return");
}
