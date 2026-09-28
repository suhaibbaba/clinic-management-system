import { Global, Module } from "@nestjs/common";
import { StorageService } from "@api/storage/storage.service";

@Global()
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
