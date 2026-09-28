import { Global, Module } from "@nestjs/common";
import { LetterheadService } from "@api/modules/billing/pdf/letterhead.service";

@Global()
@Module({
  providers: [LetterheadService],
  exports: [LetterheadService],
})
export class PdfModule {}
