import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import {
  AUDIT_ACTION,
  patientIdParamSchema,
  updateMedicalHistorySchema,
  USER_ROLE,
  type AllergyFlags,
  type MedicalHistory,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';
import {
  MEDICAL_HISTORIES_ENTITY,
  MedicalHistoriesService,
} from '@api/patients/medical-histories.service';

class UpdateMedicalHistoryDto extends createZodDto(updateMedicalHistorySchema) {}
class PatientIdParamDto extends createZodDto(patientIdParamSchema) {}

/**
 * Medical history & allergies (ROLES.md patients matrix): admin CRUD,
 * doctor CRU, technician allergy flags only, receptionist nothing.
 *
 * One row per patient, so the route carries no history id and the audit entry
 * is keyed by the patient — the same shape as `PATCH /clinic`.
 */
@Controller('patients/:patientId')
export class MedicalHistoriesController {
  constructor(private readonly medicalHistories: MedicalHistoriesService) {}

  @Get('medical-history')
  @Roles(USER_ROLE.DOCTOR)
  get(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
  ): Promise<MedicalHistory> {
    return this.medicalHistories.get(actor, params.patientId);
  }

  @Patch('medical-history')
  @Roles(USER_ROLE.DOCTOR)
  @Audit(MEDICAL_HISTORIES_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: 'patient' })
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
    @Body() body: UpdateMedicalHistoryDto,
  ): Promise<MedicalHistory> {
    return this.medicalHistories.update(actor, params.patientId, body);
  }

  /**
   * The light endpoint a technician may call: allergies and nothing else.
   * ROLES.md permits the allergy *flag* for safety while forbidding every other
   * medical detail.
   */
  @Get('allergy-flags')
  @Roles(USER_ROLE.DOCTOR, USER_ROLE.TECHNICIAN)
  allergyFlags(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: PatientIdParamDto,
  ): Promise<AllergyFlags> {
    return this.medicalHistories.allergyFlags(actor, params.patientId);
  }
}
