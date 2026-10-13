import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put } from "@nestjs/common";
import {
  AUDIT_ACTION,
  USER_ROLE,
  type PresignSiteImageResponse,
  type WebsiteEditor,
} from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { SITE_CONTENT_ENTITY } from "@api/common/constants/audit-entities";
import { WebsiteService } from "@api/modules/website/services/website.service";
import { PresignSiteImageDto, SiteContentDto } from "@api/modules/website/dto/website.dto";

@Controller("website")
export class WebsiteController {
  constructor(private readonly website: WebsiteService) {}

  @Get()
  @Roles(USER_ROLE.ADMIN)
  editor(@CurrentUser() actor: AuthenticatedUser): Promise<WebsiteEditor> {
    return this.website.editor(actor);
  }

  @Put("draft")
  @Roles(USER_ROLE.ADMIN)
  @Audit(SITE_CONTENT_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  saveDraft(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: SiteContentDto,
  ): Promise<WebsiteEditor> {
    return this.website.saveDraft(actor, body);
  }

  @Post("publish")
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  @Audit(SITE_CONTENT_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: "clinic" })
  publish(@CurrentUser() actor: AuthenticatedUser): Promise<WebsiteEditor> {
    return this.website.publish(actor);
  }

  @Post("images/presign")
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  presignImage(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: PresignSiteImageDto,
  ): Promise<PresignSiteImageResponse> {
    return this.website.presignImage(actor, body);
  }
}
