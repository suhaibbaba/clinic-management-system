import { createZodDto } from "nestjs-zod";
import { whatsAppCheckRequestSchema } from "@clinic/shared";

export class WhatsAppCheckDto extends createZodDto(whatsAppCheckRequestSchema) {}
