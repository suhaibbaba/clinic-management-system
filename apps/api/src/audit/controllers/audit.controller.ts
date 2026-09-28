import { Controller, Get, Query } from "@nestjs/common";
import { USER_ROLE, type AuditLogEntry, type Paginated } from "@clinic/shared";
import { AuditService } from "@api/audit/services/audit.service";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { Roles } from "@api/common/decorators/roles.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { ListAuditLogQueryDto } from "@api/audit/dto/audit.dto";

@Controller("audit-log")
@Roles(USER_ROLE.ADMIN)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListAuditLogQueryDto,
  ): Promise<Paginated<AuditLogEntry>> {
    return this.auditService.list(actor, query);
  }
}
