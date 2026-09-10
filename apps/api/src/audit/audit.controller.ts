import { Controller, Get, Query } from '@nestjs/common';
import {
  listAuditLogQuerySchema,
  USER_ROLE,
  type AuditLogEntry,
  type Paginated,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { AuditService } from '@api/audit/audit.service';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

class ListAuditLogQueryDto extends createZodDto(listAuditLogQuerySchema) {}

// Read only, admin only. There is deliberately no POST, PATCH, PUT or DELETE handler: the trail is
// immutable.
@Controller('audit-log')
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
