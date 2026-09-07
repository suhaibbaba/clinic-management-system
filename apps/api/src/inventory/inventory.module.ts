import { Module } from '@nestjs/common';

import { AuditModule } from '@api/audit/audit.module';
import { ClinicScopeService } from '@api/common/database/clinic-scope.service';
import { DatabaseModule } from '@api/database/database.module';
import { InventoryDocumentsService } from '@api/inventory/inventory-documents.service';
import { InventoryItemsService } from '@api/inventory/inventory-items.service';
import { InventoryReportsService } from '@api/inventory/inventory-reports.service';
import { InventoryController } from '@api/inventory/inventory.controller';
import { StockMovementsService } from '@api/inventory/stock-movements.service';
import { StockService } from '@api/inventory/stock.service';
import { SuppliersController } from '@api/inventory/suppliers.controller';
import { SuppliersService } from '@api/inventory/suppliers.service';

/**
 * Inventory: what is in the cupboard, where it came from, and what went into
 * whom.
 *
 * `StockService` is the module's centre of gravity — every quantity, expiry
 * date and flag anything here shows comes out of it, computed from the ledger
 * on read. There is no quantity column in this module and there must never be
 * one (CLAUDE.md).
 *
 * No `StorageModule` and no `AppointmentsModule`: stock has no attachments,
 * and the one ownership question — may this person write this kind of movement
 * — is a role rule rather than a "doctor owns the patient" rule, so it lives
 * in the movements service.
 */
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
  exports: [StockService, InventoryItemsService],
})
export class InventoryModule {}
