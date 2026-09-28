import { createZodDto } from "nestjs-zod";
import {
  aiChatRequestSchema,
  listAiConversationsQuerySchema,
  renameAiConversationSchema,
  idParamSchema,
} from "@clinic/shared";

export class ChatDto extends createZodDto(aiChatRequestSchema) {}

export class ListConversationsQueryDto extends createZodDto(listAiConversationsQuerySchema) {}

export class RenameConversationDto extends createZodDto(renameAiConversationSchema) {}

export class IdParamDto extends createZodDto(idParamSchema) {}
