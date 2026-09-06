import { Module } from '@nestjs/common';

import { AppointmentsModule } from '@api/appointments/appointments.module';
import { BookingController } from '@api/booking/booking.controller';
import { BookingTokenService } from '@api/booking/booking-token.service';
import { BookingService } from '@api/booking/booking.service';
import { PendingBookingsController } from '@api/booking/pending-bookings.controller';
import { AppConfigModule } from '@api/config/config.module';
import { DatabaseModule } from '@api/database/database.module';
import { NotificationsModule } from '@api/notifications/notifications.module';

/**
 * Public booking.
 *
 * It imports `AppointmentsModule` for two things it must not reimplement: the
 * pure availability service, so the slots a stranger sees are the slots
 * reception sees, and the appointments service, so the pending-confirmations
 * list is the same query the calendar uses with one filter on it.
 *
 * There is no separate "public appointment" table and no separate hold. A
 * booking is an ordinary appointment in `requested`, which is what makes the
 * database's own overlap constraint hold the slot.
 */
@Module({
  imports: [DatabaseModule, AppConfigModule, NotificationsModule, AppointmentsModule],
  controllers: [BookingController, PendingBookingsController],
  providers: [BookingService, BookingTokenService],
  exports: [BookingTokenService],
})
export class BookingModule {}
