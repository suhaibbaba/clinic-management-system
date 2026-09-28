import { Module } from "@nestjs/common";
import { AppointmentsModule } from "@api/modules/appointments/appointments.module";
import { BookingController } from "@api/modules/booking/controllers/booking.controller";
import { BookingTokenService } from "@api/modules/booking/services/booking-token.service";
import { BookingService } from "@api/modules/booking/services/booking.service";
import { PendingBookingsController } from "@api/modules/booking/controllers/pending-bookings.controller";
import { PendingBookingsService } from "@api/modules/booking/services/pending-bookings.service";
import { AppConfigModule } from "@api/config/config.module";
import { DatabaseModule } from "@api/database/database.module";
import { NotificationsModule } from "@api/modules/notifications/notifications.module";
import { StorageModule } from "@api/modules/storage/storage.module";

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
