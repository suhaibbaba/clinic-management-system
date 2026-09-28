import { Global, Module } from "@nestjs/common";
import { StorageService } from "@api/modules/storage/services/storage.service";

@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
