import { Global, Module } from '@nestjs/common';

import { StorageService } from '@api/storage/storage.service';

/** Global: any module storing files uses the same client and bucket. */
@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
