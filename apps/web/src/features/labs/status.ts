import {
  LAB_ORDER_STATUS,
  USER_ROLE,
  canTransitionLabOrder,
  type LabOrderStatus,
  type UserRole,
} from '@clinic/shared';

import type { BadgeTone } from '@web/components/ui/badge';
import { TONE_SURFACE } from '@web/components/ui/tone';
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
  /** Who the API lets make this move — the same split as `TRANSITION_ROLES`. */
  readonly roles: readonly UserRole[];
}

const STEPS: readonly StepDefinition[] = [
  {
    step: 'send',
    to: LAB_ORDER_STATUS.SENT,
    label: 'labs.actions.send',
    roles: [USER_ROLE.TECHNICIAN, USER_ROLE.DOCTOR],
  },
  {
    step: 'ready',
    to: LAB_ORDER_STATUS.READY,
    label: 'labs.actions.ready',
    roles: [USER_ROLE.TECHNICIAN],
  },
  {
    step: 'receive',
    to: LAB_ORDER_STATUS.RECEIVED,
    label: 'labs.actions.receive',
    roles: [USER_ROLE.TECHNICIAN],
  },
  {
    step: 'fit',
    to: LAB_ORDER_STATUS.FITTED,
    label: 'labs.actions.fit',
    roles: [USER_ROLE.DOCTOR],
  },
  {
    step: 'cancel',
    to: LAB_ORDER_STATUS.CANCELLED,
    label: 'labs.actions.cancel',
    roles: [USER_ROLE.TECHNICIAN, USER_ROLE.DOCTOR],
  },
];

// Two filters: the transition table decides what is possible, the role table who may do it.
// Cosmetic — the API refuses either way.
export function availableSteps(
  status: LabOrderStatus,
  role: UserRole | undefined,
): readonly StepDefinition[] {
  if (!role) {
    return [];
  }

  return STEPS.filter(
    (step) =>
      canTransitionLabOrder(status, step.to) &&
      (role === USER_ROLE.ADMIN || step.roles.includes(role)),
  );
}

/** Returning is its own action: it needs a reason, so it opens a dialog. */
export function canReturn(status: LabOrderStatus, role: UserRole | undefined): boolean {
  return (
    role !== undefined &&
    canTransitionLabOrder(status, LAB_ORDER_STATUS.RETURNED) &&
    (role === USER_ROLE.ADMIN || role === USER_ROLE.DOCTOR || role === USER_ROLE.TECHNICIAN)
  );
}
