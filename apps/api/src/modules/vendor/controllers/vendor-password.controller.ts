import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Public } from "@api/common/decorators/public.decorator";
import {
  VendorForgotPasswordDto,
  VendorResetPasswordDto,
} from "@api/modules/vendor/dto/vendor.dto";
import { VendorPasswordService } from "@api/modules/vendor/services/vendor-password.service";

@Controller("vendor/password")
@Public()
export class VendorPasswordController {
  constructor(private readonly passwords: VendorPasswordService) {}

  @Post("forgot")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  forgot(@Body() body: VendorForgotPasswordDto): Promise<void> {
    return this.passwords.forgot(body);
  }

  @Post("reset")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  reset(@Body() body: VendorResetPasswordDto): Promise<void> {
    return this.passwords.reset(body);
  }
}
