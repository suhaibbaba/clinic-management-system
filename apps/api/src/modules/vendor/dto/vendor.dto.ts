import { createZodDto } from "nestjs-zod";
import {
  createClinicSchema,
  grantSpecialtySchema,
  idParamSchema,
  paginationQuerySchema,
  saveClinicAppDomainSchema,
  saveClinicDomainSchema,
  saveClinicKeysSchema,
  saveClinicMessageChannelSchema,
  saveClinicModulesSchema,
  specialtyParamSchema,
  saveSubscriptionSchema,
  savePlanSchema,
  vendorClinicsQuerySchema,
  vendorForgotPasswordSchema,
  vendorLoginSchema,
  vendorResetPasswordSchema,
} from "@clinic/shared";

export class VendorLoginDto extends createZodDto(vendorLoginSchema) {}

export class VendorForgotPasswordDto extends createZodDto(vendorForgotPasswordSchema) {}

export class VendorResetPasswordDto extends createZodDto(vendorResetPasswordSchema) {}

export class SavePlanDto extends createZodDto(savePlanSchema) {}

export class PlansQueryDto extends createZodDto(paginationQuerySchema) {}

export class SaveSubscriptionDto extends createZodDto(saveSubscriptionSchema) {}

export class VendorClinicsQueryDto extends createZodDto(vendorClinicsQuerySchema) {}

export class SaveClinicDomainDto extends createZodDto(saveClinicDomainSchema) {}

export class SaveClinicAppDomainDto extends createZodDto(saveClinicAppDomainSchema) {}

export class SaveClinicKeysDto extends createZodDto(saveClinicKeysSchema) {}

export class SaveClinicMessageChannelDto extends createZodDto(saveClinicMessageChannelSchema) {}

export class CreateClinicDto extends createZodDto(createClinicSchema) {}

export class SaveClinicModulesDto extends createZodDto(saveClinicModulesSchema) {}

export class SpecialtyParamDto extends createZodDto(specialtyParamSchema) {}

export class GrantSpecialtyDto extends createZodDto(grantSpecialtySchema) {}

export class VendorIdParamDto extends createZodDto(idParamSchema) {}
