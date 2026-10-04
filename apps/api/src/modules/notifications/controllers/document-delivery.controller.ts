import { Controller, Get } from "@nestjs/common";
import { type DocumentDelivery } from "@clinic/shared";
import { CurrentUser } from "@api/common/decorators/current-user.decorator";
import { type AuthenticatedUser } from "@api/common/types/authenticated-user";
import { DocumentDeliveryService } from "@api/modules/notifications/services/document-delivery.service";

@Controller("document-delivery")
export class DocumentDeliveryController {
  constructor(private readonly delivery: DocumentDeliveryService) {}

  @Get()
  availability(@CurrentUser() actor: AuthenticatedUser): Promise<DocumentDelivery> {
    return this.delivery.availability(actor.clinicId);
  }
}
