import { createZodDto } from "nestjs-zod";
import { updateClinicSecretsSchema } from "@clinic/shared";

export class UpdateSecretsDto extends createZodDto(updateClinicSecretsSchema) {}
