import { MOVEMENT_TYPE, RULE, type RecordableMovementType } from "@clinic/shared";
import type { Can } from "@web/shared/providers/session";

export const seesInventory = (can: Can): boolean => can("inventory.list");

export const canManageInventory = (can: Can): boolean => can("inventory.create");

export const canDeleteItem = (can: Can): boolean => can("inventory.remove");

export const canDeleteSupplier = (can: Can): boolean => can("suppliers.remove");

export const canManageSuppliers = (can: Can): boolean => can("suppliers.create");

export const canPaySupplier = (can: Can): boolean => can("supplier-payments.create");

export const canReverseSupplierPayment = (can: Can): boolean => can("supplier-payments.reverse");

export const canConsumeStock = (can: Can): boolean => can("inventory.consume");

export const canAdjustStock = (can: Can): boolean => can("inventory.adjust");

export const canReverseMovement = (can: Can): boolean => can("inventory.reverse");

export const canPostPurchase = (can: Can): boolean => can("purchases.post");

export const canInvoiceReceipts = (can: Can): boolean => can("purchases.invoiceReceipts");

export const canWriteOff = (can: Can): boolean => can("inventory.writeOff");

export const canBlockLot = (can: Can): boolean => can("inventory.blockLot");

export const canLiftLotBlock = (can: Can): boolean => can("inventory.liftLotBlock");

export const canReturnToSupplier = (can: Can): boolean => can("purchases.returnToSupplier");

export const canRecordCreditNote = (can: Can): boolean => can("purchases.creditNote");

export const seesPurchaseRequests = (can: Can): boolean => can("purchase-requests.list");

export const canRequestPurchase = (can: Can): boolean => can("purchase-requests.create");

export const canSendPurchaseRequest = (can: Can): boolean => can("purchase-requests.send");

export const canManagePurchaseRequest = (can: Can): boolean => can("purchase-requests.cancel");

export const canCountStock = (can: Can): boolean => can("stock-counts.create");

export const canPostStockCount = (can: Can): boolean => can("stock-counts.post");

export const canReviewPurchases = (can: Can): boolean => can("purchases.reviewList");

export const canManagePackSizes = (can: Can): boolean => can("inventory.addPackSize");

export const canSeeStockReports = (can: Can): boolean =>
  can("inventory.valuation") && can(RULE.INVENTORY_COSTS);

export const canVoidInvoice = (can: Can): boolean => can("purchases.voidInvoice");

export const canSeeCosts = (can: Can): boolean => can(RULE.INVENTORY_COSTS);

export const canBackdatePurchase = (can: Can): boolean => can(RULE.BACKDATE_PURCHASES);

export const canSeeItemPrices = (can: Can): boolean =>
  can("inventory.itemPrices") && can(RULE.INVENTORY_COSTS);

export const canReversePricedPurchase = (can: Can): boolean => can(RULE.REVERSE_PRICED_PURCHASE);

export const mayRecord = (
  type: Exclude<RecordableMovementType, typeof MOVEMENT_TYPE.PURCHASE>,
  can: Can,
): boolean =>
  ({
    [MOVEMENT_TYPE.CONSUME]: canConsumeStock,
    [MOVEMENT_TYPE.ADJUST]: canAdjustStock,
  })[type](can);
