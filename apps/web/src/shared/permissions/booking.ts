import type { Can } from "@web/shared/providers/session";

export const seesPendingBookings = (can: Can): boolean => can("pending-bookings.list");

export const canConfirmBooking = (can: Can): boolean => can("pending-bookings.confirm");
export const canRejectBooking = (can: Can): boolean => can("pending-bookings.reject");
