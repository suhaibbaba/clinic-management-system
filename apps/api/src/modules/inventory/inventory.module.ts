import { Module } from "@nestjs/common";
import { AuditModule } from "@api/modules/audit/audit.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { InventoryDocumentsService } from "@api/modules/inventory/services/inventory-documents.service";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { InventoryReportsService } from "@api/modules/inventory/services/inventory-reports.service";
import { InventoryController } from "@api/modules/inventory/controllers/inventory.controller";
import { StockMovementsService } from "@api/modules/inventory/services/stock-movements.service";
import { StockService } from "@api/modules/inventory/services/stock.service";
import { SuppliersController } from "@api/modules/inventory/controllers/suppliers.controller";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [InventoryController, SuppliersController],
  providers: [
    ClinicScopeService,
    StockService,
    SuppliersService,
    InventoryItemsService,
    StockMovementsService,
    InventoryReportsService,
    InventoryDocumentsService,
  ],
  exports: [StockService, InventoryItemsService, InventoryReportsService, StockMovementsService],
})
export class InventoryModule {}
