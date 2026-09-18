import {
  AUDIT_ACTION,
  USER_ROLE,
  deleteTranslationOverrideSchema,
  upsertTranslationOverrideSchema,
  type TranslationBundle,
  type TranslationOverride,
} from "@clinic/shared";
import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { createZodDto } from "nestjs-zod";

import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import {
  TRANSLATION_OVERRIDES_ENTITY,
  TranslationsService,
} from "@api/translations/translations.service";

class UpsertTranslationDto extends createZodDto(upsertTranslationOverrideSchema) {}
class ResetTranslationDto extends createZodDto(deleteTranslationOverrideSchema) {}

@Controller("translations")
export class TranslationsController {
  constructor(private readonly translations: TranslationsService) {}

  // Every signed-in role reads the bundle: it is the wording of their own screens, and withholding
  // it would leave them reading a different app from the admin who changed it. Only an admin writes.
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

  // A reset is a delete of the row, not a write of the shipped string, so the default keeps moving
  // with the deploy.
  @Post("reset")
  @Roles(USER_ROLE.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit(TRANSLATION_OVERRIDES_ENTITY, AUDIT_ACTION.DELETE, { entityIdSource: "clinic" })
  reset(@CurrentUser() user: AuthenticatedUser, @Body() body: ResetTranslationDto): Promise<void> {
    return this.translations.reset(user, body);
  }
}
