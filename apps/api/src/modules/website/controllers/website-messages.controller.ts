import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Query,
} from "@nestjs/common";
import { AUDIT_ACTION, USER_ROLE, type ContactMessage, type Paginated } from "@clinic/shared";
import { Audit } from "@api/common/decorators/audit.decorator";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { CONTACT_MESSAGES_ENTITY } from "@api/common/constants/audit-entities";
import { ContactMessagesService } from "@api/modules/website/services/contact-messages.service";
import {
  IdParamDto,
  ListContactMessagesQueryDto,
  UpdateContactMessageDto,
} from "@api/modules/website/dto/website.dto";

@Controller("website/messages")
export class WebsiteMessagesController {
  constructor(private readonly messages: ContactMessagesService) {}

  @Get()
  @Roles(USER_ROLE.ADMIN, USER_ROLE.RECEPTIONIST)
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListContactMessagesQueryDto,
  ): Promise<Paginated<ContactMessage>> {
    return this.messages.list(actor, query);
  }

  @Patch(":id")
  @Roles(USER_ROLE.ADMIN, USER_ROLE.RECEPTIONIST)
  @Audit(CONTACT_MESSAGES_ENTITY, AUDIT_ACTION.UPDATE)
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: IdParamDto,
    @Body() body: UpdateContactMessageDto,
  ): Promise<ContactMessage> {
    return this.messages.update(actor, params.id, body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(USER_ROLE.ADMIN, USER_ROLE.RECEPTIONIST)
  @Audit(CONTACT_MESSAGES_ENTITY, AUDIT_ACTION.DELETE)
  remove(@CurrentUser() actor: AuthenticatedUser, @Param() params: IdParamDto): Promise<void> {
    return this.messages.remove(actor, params.id);
  }
}
