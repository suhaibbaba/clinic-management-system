import { Module } from "@nestjs/common";
import { NotificationsModule } from "@api/modules/notifications/notifications.module";
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
import { SupplierPaymentsController } from "@api/modules/inventory/controllers/supplier-payments.controller";
import { SupplierPaymentsService } from "@api/modules/inventory/services/supplier-payments.service";
import { SupplierAllocationsService } from "@api/modules/inventory/services/supplier-allocations.service";
import { StockLedgerService } from "@api/modules/inventory/services/stock-ledger.service";
import { PurchasingService } from "@api/modules/inventory/services/purchasing.service";
import { PurchasesController } from "@api/modules/inventory/controllers/purchases.controller";
import { WriteOffsService } from "@api/modules/inventory/services/write-offs.service";
import { LotBlocksService } from "@api/modules/inventory/services/lot-blocks.service";
import { SupplierCreditsService } from "@api/modules/inventory/services/supplier-credits.service";
import { PurchaseRequestsService } from "@api/modules/inventory/services/purchase-requests.service";
import { PurchaseRequestsController } from "@api/modules/inventory/controllers/purchase-requests.controller";
import { StockCountsService } from "@api/modules/inventory/services/stock-counts.service";
import { PurchaseReviewService } from "@api/modules/inventory/services/purchase-review.service";
import { StockCountsController } from "@api/modules/inventory/controllers/stock-counts.controller";

@Module({
  imports: [NotificationsModule, DatabaseModule, AuditModule],
  controllers: [
    InventoryController,
    SuppliersController,
    SupplierPaymentsController,
    PurchasesController,
    PurchaseRequestsController,
    StockCountsController,
  ],
  providers: [
    ClinicScopeService,
    StockService,
    SuppliersService,
    SupplierPaymentsService,
    SupplierAllocationsService,
    StockLedgerService,
    PurchasingService,
    WriteOffsService,
    LotBlocksService,
    SupplierCreditsService,
    PurchaseRequestsService,
    StockCountsService,
    PurchaseReviewService,
    InventoryItemsService,
    StockMovementsService,
    InventoryReportsService,
    InventoryDocumentsService,
  ],
  exports: [StockService, InventoryItemsService, InventoryReportsService, StockMovementsService],
})
export class InventoryModule {}
