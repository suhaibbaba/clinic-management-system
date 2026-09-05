import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AUDIT_ACTION, updateClinicSchema, USER_ROLE, type Clinic } from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CLINICS_ENTITY, ClinicsService } from '@api/clinics/clinics.service';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

class UpdateClinicDto extends createZodDto(updateClinicSchema) {}

/**
 * Clinic settings (ROLES.md core matrix): every role reads, only admin updates.
 *
 * There is no clinic id in the route — the caller's token decides which clinic
 * this is. Creating and deleting clinics is provisioning, not an API concern.
 */
@Controller('clinic')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  get(@CurrentUser() actor: AuthenticatedUser): Promise<Clinic> {
    return this.clinicsService.get(actor);
  }

  @Patch()
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: 'clinic' })
  update(@CurrentUser() actor: AuthenticatedUser, @Body() body: UpdateClinicDto): Promise<Clinic> {
    return this.clinicsService.update(actor, body);
  }
}
