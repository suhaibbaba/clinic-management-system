import { createZodDto } from "nestjs-zod";
import {
  grantSpecialtySchema,
  idParamSchema,
  paginationQuerySchema,
  saveClinicDomainSchema,
  saveSubscriptionSchema,
  savePlanSchema,
  vendorClinicsQuerySchema,
  vendorLoginSchema,
} from "@clinic/shared";

export class VendorLoginDto extends createZodDto(vendorLoginSchema) {}

export class SavePlanDto extends createZodDto(savePlanSchema) {}

export class PlansQueryDto extends createZodDto(paginationQuerySchema) {}

export class SaveSubscriptionDto extends createZodDto(saveSubscriptionSchema) {}

export class VendorClinicsQueryDto extends createZodDto(vendorClinicsQuerySchema) {}

export class SaveClinicDomainDto extends createZodDto(saveClinicDomainSchema) {}

export class GrantSpecialtyDto extends createZodDto(grantSpecialtySchema) {}

export class VendorIdParamDto extends createZodDto(idParamSchema) {}
