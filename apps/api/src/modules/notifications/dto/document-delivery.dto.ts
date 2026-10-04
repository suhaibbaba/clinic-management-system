import { createZodDto } from "nestjs-zod";
import { sendDocumentSchema } from "@clinic/shared";

export class SendDocumentDto extends createZodDto(sendDocumentSchema) {}
