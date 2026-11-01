import { SetMetadata } from "@nestjs/common";
import { type ClinicModule } from "@clinic/shared";

export const CLINIC_FEATURE_KEY = "clinicFeature";

export const ClinicFeature = (module: ClinicModule): ClassDecorator & MethodDecorator =>
  SetMetadata(CLINIC_FEATURE_KEY, module);
