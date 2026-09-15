import { LAB_ORDER_STATUS, canTransitionLabOrder, type LabOrderStatus } from '@clinic/shared';

import type { BadgeTone } from '@clinic/ui/components/badge';
import { TONE_SURFACE } from '@clinic/ui/components/tone';
import type { Can } from '@web/features/auth/session';
import type { LabOrderStep } from '@web/features/labs/queries';

// The column header, the badge and the chip all read this, so a status cannot be amber in one place
// and grey in another. The colour itself comes from `TONE_SURFACE`.
export interface LabStatusStyle {
  readonly tone: BadgeTone;
  readonly column: string;
  readonly label: string;
}

const column = (tone: BadgeTone, label: string): LabStatusStyle => ({
  tone,
  column: TONE_SURFACE[tone],
  label,
});

export const LAB_ORDER_STATUS_STYLES: Record<LabOrderStatus, LabStatusStyle> = {
  // Not yet anybody's problem but the doctor's: it has not left the building.
  [LAB_ORDER_STATUS.DRAFT]: column('neutral', 'labs.status.draft'),
  [LAB_ORDER_STATUS.SENT]: column('info', 'labs.status.sent'),
  [LAB_ORDER_STATUS.READY]: column('warning', 'labs.status.ready'),
  [LAB_ORDER_STATUS.RECEIVED]: column('success', 'labs.status.received'),
  // Done is history: it recedes rather than celebrating.
  [LAB_ORDER_STATUS.FITTED]: column('neutral', 'labs.status.fitted'),
  [LAB_ORDER_STATUS.RETURNED]: column('danger', 'labs.status.returned'),
  [LAB_ORDER_STATUS.CANCELLED]: column('neutral', 'labs.status.cancelled'),
};

export const BOARD_COLUMNS: readonly LabOrderStatus[] = [
  LAB_ORDER_STATUS.DRAFT,
  LAB_ORDER_STATUS.SENT,
  LAB_ORDER_STATUS.READY,
  LAB_ORDER_STATUS.RECEIVED,
  LAB_ORDER_STATUS.FITTED,
];

interface StepDefinition {
  readonly step: LabOrderStep;
  readonly to: LabOrderStatus;
  readonly label: string;
  /** The permission the API asks for on this move. */
  readonly capability: string;
}

const STEPS: readonly StepDefinition[] = [
  {
    step: 'send',
    to: LAB_ORDER_STATUS.SENT,
    label: 'labs.actions.send',
    capability: 'lab-orders.send',
  },
  {
    step: 'ready',
    to: LAB_ORDER_STATUS.READY,
    label: 'labs.actions.ready',
    capability: 'lab-orders.ready',
  },
  {
    step: 'receive',
    to: LAB_ORDER_STATUS.RECEIVED,
    label: 'labs.actions.receive',
    capability: 'lab-orders.receive',
  },
  {
    step: 'fit',
    to: LAB_ORDER_STATUS.FITTED,
    label: 'labs.actions.fit',
    capability: 'lab-orders.fit',
  },
  {
    step: 'cancel',
    to: LAB_ORDER_STATUS.CANCELLED,
    label: 'labs.actions.cancel',
    capability: 'lab-orders.cancel',
  },
];

// Two filters: the transition table decides what is possible, the clinic's permissions who may do
// it. Cosmetic — the API refuses either way.
export function availableSteps(status: LabOrderStatus, can: Can): readonly StepDefinition[] {
  return STEPS.filter((step) => canTransitionLabOrder(status, step.to) && can(step.capability));
}

/** Returning is its own action: it needs a reason, so it opens a dialog. */
export function canReturn(status: LabOrderStatus, can: Can): boolean {
  return canTransitionLabOrder(status, LAB_ORDER_STATUS.RETURNED) && can('lab-orders.return');
}
