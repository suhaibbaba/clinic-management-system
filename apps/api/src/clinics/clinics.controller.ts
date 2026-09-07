import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import {
  AUDIT_ACTION,
  confirmClinicLogoSchema,
  presignClinicLogoSchema,
  updateClinicSchema,
  USER_ROLE,
  type Clinic,
  type ClinicBranding,
  type PresignClinicLogoResponse,
} from '@clinic/shared';
import { createZodDto } from 'nestjs-zod';

import { Audit } from '@api/common/decorators/audit.decorator';
import { CLINICS_ENTITY, ClinicsService } from '@api/clinics/clinics.service';
import { CurrentUser } from '@api/common/decorators/current-user.decorator';
import { Public } from '@api/common/decorators/public.decorator';
import { Roles } from '@api/common/decorators/roles.decorator';
import type { AuthenticatedUser } from '@api/common/types/authenticated-user';

class UpdateClinicDto extends createZodDto(updateClinicSchema) {}
class PresignLogoDto extends createZodDto(presignClinicLogoSchema) {}
class ConfirmLogoDto extends createZodDto(confirmClinicLogoSchema) {}

/**
 * Clinic settings (ROLES.md core matrix): every role reads, only admin updates.
 *
 * There is no clinic id in the route — the caller's token decides which clinic
 * this is. Creating and deleting clinics is provisioning, not an API concern.
 */
@Controller('clinic')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  /**
   * The name and mark the sign-in screen draws, before there is a caller.
   *
   * Public because the login page has no token yet, and safe to be: it carries
   * a name and an image and says nothing about who works here or how many
   * clinics this deployment serves.
   */
  @Get('branding')
  @Public()
  branding(): Promise<ClinicBranding> {
    return this.clinicsService.branding();
  }

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

  /**
   * Step 1 of the logo upload. Not audited: nothing has changed yet, and a
   * signature the browser never uses leaves no trace worth keeping.
   */
  @Post('logo/presign')
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  presignLogo(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: PresignLogoDto,
  ): Promise<PresignClinicLogoResponse> {
    return this.clinicsService.presignLogo(actor, body);
  }

  /** Step 2, and the point at which the clinic row changes. */
  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: 'clinic' })
  confirmLogo(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: ConfirmLogoDto,
  ): Promise<Clinic> {
    return this.clinicsService.confirmLogo(actor, body);
  }

  @Delete('logo')
  @Roles(USER_ROLE.ADMIN)
  @Audit(CLINICS_ENTITY, AUDIT_ACTION.UPDATE, { entityIdSource: 'clinic' })
  removeLogo(@CurrentUser() actor: AuthenticatedUser): Promise<Clinic> {
    return this.clinicsService.removeLogo(actor);
  }
}
