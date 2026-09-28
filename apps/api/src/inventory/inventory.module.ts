import { Module } from "@nestjs/common";
import { AuditModule } from "@api/audit/audit.module";
import { ClinicScopeService } from "@api/common/database/clinic-scope.service";
import { DatabaseModule } from "@api/database/database.module";
import { InventoryDocumentsService } from "@api/inventory/services/inventory-documents.service";
import { InventoryItemsService } from "@api/inventory/services/inventory-items.service";
import { InventoryReportsService } from "@api/inventory/services/inventory-reports.service";
import { InventoryController } from "@api/inventory/controllers/inventory.controller";
import { StockMovementsService } from "@api/inventory/services/stock-movements.service";
import { StockService } from "@api/inventory/services/stock.service";
import { SuppliersController } from "@api/inventory/controllers/suppliers.controller";
import { SuppliersService } from "@api/inventory/services/suppliers.service";

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
