import { Controller, Get } from "@nestjs/common";
import { type AuthenticatedUserProfile } from "@clinic/shared";
import { AuthService } from "@api/modules/auth/services/auth.service";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";

@Controller("me")
export class MeController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  getProfile(@CurrentUser() actor: AuthenticatedUser): Promise<AuthenticatedUserProfile> {
    return this.authService.getProfile(actor);
  }
}
