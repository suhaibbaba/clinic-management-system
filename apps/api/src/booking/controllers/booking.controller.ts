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
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import {
  type BookingReceipt,
  type ManagedBooking,
  type PublicClinic,
  type PublicDoctor,
  type PublicSlots,
  type UrgentRequestReceipt,
} from "@clinic/shared";
import { BookingService } from "@api/booking/services/booking.service";
import { Public } from "@api/common/decorators/public.decorator";
import {
  SlugParamDto,
  PublicSlotsQueryDto,
  CreateBookingDto,
  CreateUrgentRequestDto,
  VerifyOtpDto,
  TokenParamDto,
  CancelBookingDto,
  RescheduleBookingDto,
} from "@api/booking/dto/booking.dto";

@Controller("public/booking")
@Public()
@UseGuards(ThrottlerGuard)
export class BookingController {
  constructor(private readonly booking: BookingService) {}

  @Get(":clinicSlug")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  clinic(@Param() params: SlugParamDto): Promise<PublicClinic> {
    return this.booking.clinicBySlug(params.clinicSlug);
  }

  @Get(":clinicSlug/doctors")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  doctors(@Param() params: SlugParamDto): Promise<PublicDoctor[]> {
    return this.booking.doctors(params.clinicSlug);
  }

  @Get(":clinicSlug/slots")
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  slots(@Param() params: SlugParamDto, @Query() query: PublicSlotsQueryDto): Promise<PublicSlots> {
    return this.booking.slots(params.clinicSlug, query);
  }

  @Post(":clinicSlug")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  book(@Param() params: SlugParamDto, @Body() body: CreateBookingDto): Promise<BookingReceipt> {
    return this.booking.book(params.clinicSlug, body);
  }

  @Post(":clinicSlug/urgent-request")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestUrgent(
    @Param() params: SlugParamDto,
    @Body() body: CreateUrgentRequestDto,
  ): Promise<UrgentRequestReceipt> {
    return this.booking.requestUrgent(params.clinicSlug, body);
  }

  @Post(":clinicSlug/verify-otp")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verify(@Param() params: SlugParamDto, @Body() body: VerifyOtpDto): Promise<ManagedBooking> {
    return this.booking.verifyOtp(params.clinicSlug, body.token, body.code);
  }

  @Get("manage/:token")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  view(@Param() params: TokenParamDto): Promise<ManagedBooking> {
    return this.booking.view(params.token);
  }

  @Post("manage/:token/cancel")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  cancel(@Param() params: TokenParamDto, @Body() body: CancelBookingDto): Promise<ManagedBooking> {
    return this.booking.cancel(params.token, body.reason);
  }

  @Post("manage/:token/reschedule")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  reschedule(
    @Param() params: TokenParamDto,
    @Body() body: RescheduleBookingDto,
  ): Promise<ManagedBooking> {
    return this.booking.reschedule(params.token, body.startsAt);
  }
}
