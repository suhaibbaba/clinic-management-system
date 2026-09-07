import { Global, Module } from '@nestjs/common';

import { LetterheadService } from '@api/billing/pdf/letterhead.service';

/**
 * The printed sheet's shared furniture.
 *
 * Global for the same reason `StorageModule` is: billing, labs and inventory
 * all print, and every one of them puts the same clinic's mark and name at the
 * top. A module each would import would be three chances for one of them to
 * stop doing it.
 */
@Global()
@Module({
  providers: [LetterheadService],
  exports: [LetterheadService],
})
export class PdfModule {}
