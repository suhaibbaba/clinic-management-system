import { LAB_ORDER_STATUS, USER_ROLE } from '@clinic/shared';
import { describe, expect, it } from 'vitest';

import { availableSteps, canReturn } from '@web/features/labs/status';

const stepsFor = (
  status: Parameters<typeof availableSteps>[0],
  role: Parameters<typeof availableSteps>[1],
) => availableSteps(status, role).map((step) => step.step);

describe('availableSteps', () => {
  it('offers a technician the lab-side moves and never the fitting', () => {
    expect(stepsFor(LAB_ORDER_STATUS.DRAFT, USER_ROLE.TECHNICIAN)).toEqual(['send', 'cancel']);
    expect(stepsFor(LAB_ORDER_STATUS.SENT, USER_ROLE.TECHNICIAN)).toEqual(['ready', 'cancel']);
    expect(stepsFor(LAB_ORDER_STATUS.READY, USER_ROLE.TECHNICIAN)).toEqual(['receive']);
    expect(stepsFor(LAB_ORDER_STATUS.RECEIVED, USER_ROLE.TECHNICIAN)).toEqual([]);
  });

  it('offers a doctor the fitting and never the receiving', () => {
    expect(stepsFor(LAB_ORDER_STATUS.RECEIVED, USER_ROLE.DOCTOR)).toEqual(['fit']);
    expect(stepsFor(LAB_ORDER_STATUS.READY, USER_ROLE.DOCTOR)).toEqual([]);
  });

  it('lets an admin make any move the status allows', () => {
    expect(stepsFor(LAB_ORDER_STATUS.READY, USER_ROLE.ADMIN)).toEqual(['receive']);
    expect(stepsFor(LAB_ORDER_STATUS.RECEIVED, USER_ROLE.ADMIN)).toEqual(['fit']);
  });

  it('offers a receptionist nothing at all — no row of the labs matrix is theirs', () => {
    for (const status of Object.values(LAB_ORDER_STATUS)) {
      expect(stepsFor(status, USER_ROLE.RECEPTIONIST)).toEqual([]);
      expect(canReturn(status, USER_ROLE.RECEPTIONIST)).toBe(false);
    }
  });

  it('offers nothing on a finished or cancelled order', () => {
    expect(stepsFor(LAB_ORDER_STATUS.FITTED, USER_ROLE.ADMIN)).toEqual([]);
    expect(stepsFor(LAB_ORDER_STATUS.CANCELLED, USER_ROLE.ADMIN)).toEqual([]);
    expect(stepsFor(LAB_ORDER_STATUS.RETURNED, USER_ROLE.TECHNICIAN)).toEqual(['send']);
  });

  it('allows a return only from the three statuses that have the work in hand', () => {
    expect(canReturn(LAB_ORDER_STATUS.READY, USER_ROLE.DOCTOR)).toBe(true);
    expect(canReturn(LAB_ORDER_STATUS.RECEIVED, USER_ROLE.DOCTOR)).toBe(true);
    expect(canReturn(LAB_ORDER_STATUS.FITTED, USER_ROLE.DOCTOR)).toBe(true);
    expect(canReturn(LAB_ORDER_STATUS.SENT, USER_ROLE.DOCTOR)).toBe(false);
    expect(canReturn(LAB_ORDER_STATUS.DRAFT, USER_ROLE.DOCTOR)).toBe(false);
  });
});
