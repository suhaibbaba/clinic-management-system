import {
  AUDIT_ACTION,
  USER_ROLE,
  type TranslationBundle,
  type TranslationOverride,
} from "@clinic/shared";
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { TRANSLATION_OVERRIDES_ENTITY } from "@api/translations/constants";
import { TranslationsService } from "@api/translations/services/translations.service";
import {
  UpsertTranslationDto,
  SaveTranslationsDto,
  ResetTranslationDto,
} from "@api/translations/dto/translations.dto";

@Controller("translations")
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  @Get()
  bundle(@CurrentUser() user: AuthenticatedUser): Promise<TranslationBundle> {
    return this.translations.bundle(user);
  }

  @Get("overrides")
  @Roles(USER_ROLE.ADMIN)
  list(@CurrentUser() user: AuthenticatedUser): Promise<TranslationOverride[]> {
    return this.translations.list(user);
  }

  @Post()
  @Roles(USER_ROLE.ADMIN)
  @Audit(TRANSLATION_OVERRIDES_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpsertTranslationDto,
  ): Promise<TranslationOverride> {
    return this.translations.upsert(user, body);
  }

  @Post("save")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(TRANSLATION_OVERRIDES_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  save(@CurrentUser() user: AuthenticatedUser, @Body() body: SaveTranslationsDto): Promise<void> {
    return this.translations.save(user, body);
  }

  @Post("reset")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(TRANSLATION_OVERRIDES_ENTITY, AUDIT_ACTION.DELETE, { entityIdSource: "clinic" })
  reset(@CurrentUser() user: AuthenticatedUser, @Body() body: ResetTranslationDto): Promise<void> {
    return this.translations.reset(user, body);
  }
}
