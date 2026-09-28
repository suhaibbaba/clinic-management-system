import { Module } from "@nestjs/common";
import { AppointmentsModule } from "@api/appointments/appointments.module";
import { BookingController } from "@api/booking/controllers/booking.controller";
import { BookingTokenService } from "@api/booking/services/booking-token.service";
import { BookingService } from "@api/booking/services/booking.service";
import { PendingBookingsController } from "@api/booking/controllers/pending-bookings.controller";
import { PendingBookingsService } from "@api/booking/services/pending-bookings.service";
import { AppConfigModule } from "@api/config/config.module";
import { DatabaseModule } from "@api/database/database.module";
import { NotificationsModule } from "@api/notifications/notifications.module";
import { StorageModule } from "@api/storage/storage.module";

@Module({
  imports: [
    DatabaseModule,
    AppConfigModule,
    NotificationsModule,
    AppointmentsModule,
    StorageModule,
  ],
  controllers: [BookingController, PendingBookingsController],
  providers: [BookingService, BookingTokenService, PendingBookingsService],
  exports: [BookingTokenService],
})
export class BookingModule {}
