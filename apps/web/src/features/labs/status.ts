import {
  LAB_ORDER_STATUS,
  USER_ROLE,
  canTransitionLabOrder,
  type LabOrderStatus,
  type UserRole,
} from '@clinic/shared';

import type { BadgeTone } from '@web/components/ui/badge';
import type { LabOrderStep } from '@web/features/labs/queries';

/**
 * What a lab-order status looks like, in one table.
 *
 * The board draws a column header, the drawer draws a badge and a row draws a
 * chip — all three read this, so a status can never be amber in one place and
 * grey in another. Every value is a `theme.css` token; no hex anywhere.
 */
export interface LabStatusStyle {
  readonly tone: BadgeTone;
  /** The column header on the board. */
  readonly column: string;
  readonly label: string;
}

export const LAB_ORDER_STATUS_STYLES: Record<LabOrderStatus, LabStatusStyle> = {
  // Not yet anybody's problem but the doctor's: it has not left the building.
  [LAB_ORDER_STATUS.DRAFT]: {
    tone: 'neutral',
    column: 'border-line-strong bg-inset text-ink-muted',
    label: 'labs.status.draft',
  },
  [LAB_ORDER_STATUS.SENT]: {
    tone: 'info',
    column: 'border-primary-200 bg-primary-50 text-primary-800',
    label: 'labs.status.sent',
  },
  [LAB_ORDER_STATUS.READY]: {
    tone: 'warning',
    column: 'border-warning-300 bg-warning-50 text-warning-800',
    label: 'labs.status.ready',
  },
  [LAB_ORDER_STATUS.RECEIVED]: {
    tone: 'success',
    column: 'border-success-300 bg-success-50 text-success-800',
    label: 'labs.status.received',
  },
  // Done is history: it recedes rather than celebrating.
  [LAB_ORDER_STATUS.FITTED]: {
    tone: 'neutral',
    column: 'border-line-strong bg-inset text-ink-muted',
    label: 'labs.status.fitted',
  },
  [LAB_ORDER_STATUS.RETURNED]: {
    tone: 'danger',
    column: 'border-danger-200 bg-danger-50 text-danger-700',
    label: 'labs.status.returned',
  },
  [LAB_ORDER_STATUS.CANCELLED]: {
    tone: 'neutral',
    column: 'border-line-strong bg-inset text-ink-subtle',
    label: 'labs.status.cancelled',
  },
};

/** The columns of the board, left to right in the order work moves through. */
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

/**
 * The moves this person can make on this order, right now.
 *
 * Two filters, and both matter: the shared transition table decides what is
 * possible at all, and the role table decides who may do it. Hiding a button
 * the API would refuse is the difference between a board people trust and one
 * that throws errors at them — but it is *only* cosmetic, and the API refuses
 * it either way.
 */
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
