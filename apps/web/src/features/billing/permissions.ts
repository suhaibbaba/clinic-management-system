import { USER_ROLE, type UserRole } from '@clinic/shared';

import type { Can } from '@web/features/auth/session';

// A technician never sees financial patient data, so the API does not put a balance in their
// patient response at all. A response's shape is the permission, and no switch moves it — which is
// why this one stays a role and the two below do not.
export const canSeeBilling = (role: UserRole): boolean => role !== USER_ROLE.TECHNICIAN;

/** Taking money. */
export const canRecordPayment = (can: Can): boolean => can('payments.create');

/** The only correction there is: nobody updates or deletes a payment. */
export const canReversePayment = (can: Can): boolean => can('payments.reverse');
