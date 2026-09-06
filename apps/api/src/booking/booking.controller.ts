import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  cancelBookingSchema,
  createBookingSchema,
  publicSlotsQuerySchema,
  rescheduleBookingSchema,
  verifyOtpSchema,
  type BookingReceipt,
  type ManagedBooking,
  type PublicClinic,
  type PublicDoctor,
  type PublicSlots,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { BookingService } from '@api/booking/booking.service';
import { Public } from '@api/common/decorators/public.decorator';

class CreateBookingDto extends createZodDto(createBookingSchema) {}
class VerifyOtpDto extends createZodDto(verifyOtpSchema) {}
class RescheduleBookingDto extends createZodDto(rescheduleBookingSchema) {}
class CancelBookingDto extends createZodDto(cancelBookingSchema) {}
class PublicSlotsQueryDto extends createZodDto(publicSlotsQuerySchema) {}

/** A clinic handle, not an id: lowercase letters, digits and hyphens. */
const slugParamSchema = z.object({
  clinicSlug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/, 'Not a clinic handle'),
});
class SlugParamDto extends createZodDto(slugParamSchema) {}

const tokenParamSchema = z.object({ token: z.string().min(10).max(400) });
class TokenParamDto extends createZodDto(tokenParamSchema) {}

/**
 * The public booking API. Every route is `@Public()` and every route is
 * throttled (ROLES.md enforcement step 7).
 *
 * Three things hold this together, and none of them is authentication:
 *
 *  - **The clinic comes from the URL slug**, never from a body field. A caller
 *    cannot point a booking at a clinic by editing a payload.
 *  - **No response distinguishes a known phone from an unknown one.** That is
 *    what stops a stranger walking a phone book to learn who is a patient here,
 *    which would be a medical disclosure. The reads below carry a doctor's name
 *    and a free time — nothing about any patient at all.
 *  - **Writes are rate limited harder than reads.** Booking, verifying and
 *    cancelling each cost a database write and, in two cases, a message; the
 *    limits below are per IP, and `BookingService` applies a second limit per
 *    phone number, because one IP is one café and one phone is one person.
 */
@Controller('public/booking')
@Public()
@UseGuards(ThrottlerGuard)
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  /* ------------------------------- Reads -------------------------------- */

  @Get(':clinicSlug')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  clinic(@Param() params: SlugParamDto): Promise<PublicClinic> {
    return this.booking.clinicBySlug(params.clinicSlug);
  }

  @Get(':clinicSlug/doctors')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  doctors(@Param() params: SlugParamDto): Promise<PublicDoctor[]> {
    return this.booking.doctors(params.clinicSlug);
  }

  @Get(':clinicSlug/slots')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  slots(@Param() params: SlugParamDto, @Query() query: PublicSlotsQueryDto): Promise<PublicSlots> {
    return this.booking.slots(params.clinicSlug, query);
  }

  /* ------------------------------- Writes ------------------------------- */

  /** Five bookings a minute from one address is already a lot of families. */
  @Post(':clinicSlug')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  book(@Param() params: SlugParamDto, @Body() body: CreateBookingDto): Promise<BookingReceipt> {
    return this.booking.book(params.clinicSlug, body);
  }

  /**
   * Ten a minute, which is well above a person mistyping six digits and well
   * below anything that could grind through a million codes — and the code
   * itself dies after three wrong guesses regardless.
   */
  @Post(':clinicSlug/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@Param() params: SlugParamDto, @Body() body: VerifyOtpDto): Promise<ManagedBooking> {
    return this.booking.verifyOtp(params.clinicSlug, body.token, body.code);
  }

  /* ---------------------------- Manage link ----------------------------- */

  /*
   * Deliberately not under `:clinicSlug`: the token already names the booking,
   * and requiring the slug too would mean a patient who mistypes the clinic
   * gets a different error than one who mistypes the token — an oracle.
   */

  @Get('manage/:token')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  view(@Param() params: TokenParamDto): Promise<ManagedBooking> {
    return this.booking.view(params.token);
  }

  @Post('manage/:token/cancel')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cancel(@Param() params: TokenParamDto, @Body() body: CancelBookingDto): Promise<ManagedBooking> {
    return this.booking.cancel(params.token, body.reason);
  }

  @Post('manage/:token/reschedule')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  reschedule(
    @Param() params: TokenParamDto,
    @Body() body: RescheduleBookingDto,
  ): Promise<ManagedBooking> {
    return this.booking.reschedule(params.token, body.startsAt);
  }
}
