import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { USER_ROLE, type WhatsAppCheck } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { WhatsAppCheckDto } from "@api/modules/notifications/dto/whatsapp-checks.dto";
import { WhatsAppChecksService } from "@api/modules/notifications/services/whatsapp-checks.service";

@Controller("whatsapp-checks")
export class WhatsAppChecksController {
  constructor(private readonly checks: WhatsAppChecksService) {}

  @Get()
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  find(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: WhatsAppCheckDto,
  ): Promise<WhatsAppCheck> {
    return this.checks.find(actor, query.phone);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN, USER_ROLE.RECEPTIONIST)
  check(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: WhatsAppCheckDto,
  ): Promise<WhatsAppCheck> {
    return this.checks.check(actor, body.phone);
  }
}
