import { Controller, Get, Param } from '@nestjs/common';
import { patientToothParamSchema, USER_ROLE, type ToothHistory } from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import { ToothHistoryService } from '@api/patients/tooth-history.service';

class PatientToothParamDto extends createZodDto(patientToothParamSchema) {}

// It aggregates procedures, chart marks and attachments, so it is limited to the roles that may
// read all three: admin and doctor.
@Controller('patients/:patientId/teeth')
@Roles(USER_ROLE.DOCTOR)
export class ToothHistoryController {
  constructor(private readonly toothHistory: ToothHistoryService) {}

  @Get(':fdi')
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientToothParamDto,
  ): Promise<ToothHistory> {
    return this.toothHistory.get(actor, params.patientId, params.fdi);
  }
}
