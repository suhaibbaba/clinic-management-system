import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import type {
  AdjustStockInput,
  CreatePurchaseRequestInput,
  CreateStockCountInput,
  ListPurchaseRequestsQuery,
  PurchaseRequest,
  RecordCountsInput,
  SendPurchaseRequestInput,
  StockCount,
  StockCountSummary,
  UpdatePurchaseRequestInput,
  BlockLotInput,
  LotBlock,
  PriceDocumentInput,
  SupplierReturnInput,
  WriteOffInput,
  ConsumeStockInput,
  CreateInventoryItemInput,
  CreateSupplierInput,
  CreateSupplierPaymentInput,
  InvoiceReceiptsInput,
  PostPurchaseInput,
  SupplierInvoiceSummary,
  UninvoicedLine,
  InventoryAlerts,
  InventoryItemRow,
  ItemBatches,
  ListInventoryItemsQuery,
  ListMovementsQuery,
  ListSuppliersQuery,
  Paginated,
  PurchaseStockInput,
  ShoppingList,
  StatementRangeQuery,
  StockMovementRow,
  SupplierStatement,
  SupplierSummary,
  UpdateInventoryItemInput,
  UpdateSupplierInput,
} from "@clinic/shared";
import {
  inventoryApi,
  purchaseRequestsApi,
  purchasesApi,
  stockCountsApi,
  suppliersApi,
} from "@web/modules/inventory/api";

export const ITEMS_KEY = "inventory-items";
export const MOVEMENTS_KEY = "stock-movements";
export const BATCHES_KEY = "item-batches";
export const ALERTS_KEY = "inventory-alerts";
export const SHOPPING_LIST_KEY = "shopping-list";
export const SUPPLIERS_KEY = "suppliers";
export const SUPPLIER_STATEMENT_KEY = "supplier-statement";
export const SUPPLIER_INVOICES_KEY = "supplier-invoices";
export const UNINVOICED_KEY = "supplier-uninvoiced";
export const LOT_BLOCKS_KEY = "lot-blocks";
export const PURCHASE_REQUESTS_KEY = "purchase-requests";
export const STOCK_COUNTS_KEY = "stock-counts";

const STOCK_KEYS = [
  ITEMS_KEY,
  MOVEMENTS_KEY,
  BATCHES_KEY,
  ALERTS_KEY,
  SHOPPING_LIST_KEY,
  SUPPLIERS_KEY,
  SUPPLIER_STATEMENT_KEY,
  SUPPLIER_INVOICES_KEY,
  UNINVOICED_KEY,
  LOT_BLOCKS_KEY,
  PURCHASE_REQUESTS_KEY,
  STOCK_COUNTS_KEY,
];

function useStockMutation<TArgs, TResult>(mutationFn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => {
      for (const key of STOCK_KEYS) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

export function useInventoryItems(
  query: Partial<ListInventoryItemsQuery> = {},
): UseQueryResult<Paginated<InventoryItemRow>> {
  return useQuery({
    queryKey: [ITEMS_KEY, query],
    queryFn: () => inventoryApi.items(query),
    placeholderData: (previous) => previous,
  });
}

export function useInventoryItem(id: string): UseQueryResult<InventoryItemRow> {
  return useQuery({
    queryKey: [ITEMS_KEY, "one", id],
    queryFn: () => inventoryApi.item(id),
    enabled: id !== "",
  });
}

export function useItemBatches(id: string): UseQueryResult<ItemBatches> {
  return useQuery({
    queryKey: [BATCHES_KEY, id],
    queryFn: () => inventoryApi.batches(id),
    enabled: id !== "",
  });
}

export function useItemMovements(
  id: string,
  query: Partial<ListMovementsQuery> = {},
): UseQueryResult<Paginated<StockMovementRow>> {
  return useQuery({
    queryKey: [MOVEMENTS_KEY, id, query],
    queryFn: () => inventoryApi.itemMovements(id, query),
    placeholderData: (previous) => previous,
    enabled: id !== "",
  });
}

export function useInventoryAlerts(enabled = true): UseQueryResult<InventoryAlerts> {
  return useQuery({ queryKey: [ALERTS_KEY], queryFn: () => inventoryApi.alerts(), enabled });
}

export function useShoppingList(): UseQueryResult<ShoppingList> {
  return useQuery({ queryKey: [SHOPPING_LIST_KEY], queryFn: () => inventoryApi.shoppingList() });
}

export function useSuppliers(
  query: Partial<ListSuppliersQuery> = {},
): UseQueryResult<Paginated<SupplierSummary>> {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, query],
    queryFn: () => suppliersApi.list(query),
    placeholderData: (previous) => previous,
  });
}

export function useSupplier(id: string): UseQueryResult<SupplierSummary> {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, "one", id],
    queryFn: () => suppliersApi.findOne(id),
    enabled: id !== "",
  });
}

export function useSupplierStatement(
  id: string,
  query: StatementRangeQuery,
): UseQueryResult<SupplierStatement> {
  return useQuery({
    queryKey: [SUPPLIER_STATEMENT_KEY, id, query],
    queryFn: () => suppliersApi.statement(id, query),
    placeholderData: (previous) => previous,
    enabled: id !== "",
  });
}

export function useSupplierInvoices(id: string): UseQueryResult<SupplierInvoiceSummary[]> {
  return useQuery({
    queryKey: [SUPPLIER_INVOICES_KEY, id],
    queryFn: () => suppliersApi.invoices(id),
    enabled: id !== "",
  });
}

export function useUninvoiced(id: string): UseQueryResult<UninvoicedLine[]> {
  return useQuery({
    queryKey: [UNINVOICED_KEY, id],
    queryFn: () => suppliersApi.uninvoiced(id),
    enabled: id !== "",
  });
}

export function useLotBlocks(itemId?: string): UseQueryResult<LotBlock[]> {
  return useQuery({
    queryKey: [LOT_BLOCKS_KEY, itemId ?? "all"],
    queryFn: () => inventoryApi.lotBlocks(itemId ? { itemId } : {}),
  });
}

export function useWriteOff() {
  return useStockMutation((input: WriteOffInput) => inventoryApi.writeOff(input));
}

export function useBlockLot() {
  return useStockMutation(({ itemId, body }: { itemId: string; body: BlockLotInput }) =>
    inventoryApi.blockLot(itemId, body),
  );
}

export function useLiftLotBlock() {
  return useStockMutation(({ id, reason }: { id: string; reason: string }) =>
    inventoryApi.liftLotBlock(id, reason),
  );
}

export function useReturnToSupplier() {
  return useStockMutation((input: SupplierReturnInput) => purchasesApi.returnToSupplier(input));
}

export function useCreditNote() {
  return useStockMutation((input: PriceDocumentInput) => purchasesApi.creditNote(input));
}

export function usePostPurchase() {
  return useStockMutation((input: PostPurchaseInput) => purchasesApi.post(input));
}

export function useInvoiceReceipts() {
  return useStockMutation((input: InvoiceReceiptsInput) => purchasesApi.invoiceReceipts(input));
}

export function useCreateItem() {
  return useStockMutation((input: CreateInventoryItemInput) => inventoryApi.createItem(input));
}

export function useUpdateItem() {
  return useStockMutation(({ id, body }: { id: string; body: UpdateInventoryItemInput }) =>
    inventoryApi.updateItem(id, body),
  );
}

export function useDeleteItem() {
  return useStockMutation((id: string) => inventoryApi.removeItem(id));
}

export function usePurchaseStock() {
  return useStockMutation((input: PurchaseStockInput) => inventoryApi.purchase(input));
}

export function useConsumeStock() {
  return useStockMutation((input: ConsumeStockInput) => inventoryApi.consume(input));
}

export function useAdjustStock() {
  return useStockMutation((input: AdjustStockInput) => inventoryApi.adjust(input));
}

export function useReverseMovement() {
  return useStockMutation(({ id, reason }: { id: string; reason: string }) =>
    inventoryApi.reverse(id, { reason }),
  );
}

export function useCreateSupplier() {
  return useStockMutation((input: CreateSupplierInput) => suppliersApi.create(input));
}

export function useUpdateSupplier() {
  return useStockMutation(({ id, body }: { id: string; body: UpdateSupplierInput }) =>
    suppliersApi.update(id, body),
  );
}

export function usePaySupplier() {
  return useStockMutation((input: CreateSupplierPaymentInput) => suppliersApi.pay(input));
}

export function useVoidInvoice() {
  return useStockMutation(({ id, reason }: { id: string; reason: string }) =>
    suppliersApi.voidInvoice(id, reason),
  );
}

export function useReverseSupplierPayment() {
  return useStockMutation(({ id, reason }: { id: string; reason: string }) =>
    suppliersApi.reversePayment(id, reason),
  );
}

export function useDeleteSupplier() {
  return useStockMutation((id: string) => suppliersApi.remove(id));
}

export function usePurchaseRequests(
  query: Partial<ListPurchaseRequestsQuery>,
): UseQueryResult<Paginated<PurchaseRequest>> {
  return useQuery({
    queryKey: [PURCHASE_REQUESTS_KEY, query],
    queryFn: () => purchaseRequestsApi.list(query),
  });
}

export function usePurchaseRequest(id: string): UseQueryResult<PurchaseRequest> {
  return useQuery({
    queryKey: [PURCHASE_REQUESTS_KEY, "one", id],
    queryFn: () => purchaseRequestsApi.get(id),
    enabled: id !== "",
  });
}

export function useCreatePurchaseRequest() {
  return useStockMutation((input: CreatePurchaseRequestInput) => purchaseRequestsApi.create(input));
}

export function useRequestBelowMinimum() {
  return useStockMutation(() => purchaseRequestsApi.belowMinimum());
}

export function useUpdatePurchaseRequest() {
  return useStockMutation(({ id, body }: { id: string; body: UpdatePurchaseRequestInput }) =>
    purchaseRequestsApi.update(id, body),
  );
}

export function useSendPurchaseRequest() {
  return useStockMutation(({ id, body }: { id: string; body: SendPurchaseRequestInput }) =>
    purchaseRequestsApi.send(id, body),
  );
}

export function useMarkRequestOrdered() {
  return useStockMutation((id: string) => purchaseRequestsApi.markOrdered(id));
}

export function useCloseRequest() {
  return useStockMutation((id: string) => purchaseRequestsApi.close(id));
}

export function useCancelRequest() {
  return useStockMutation(({ id, reason }: { id: string; reason: string }) =>
    purchaseRequestsApi.cancel(id, reason),
  );
}

export function useStockCounts(enabled = true): UseQueryResult<StockCountSummary[]> {
  return useQuery({
    queryKey: [STOCK_COUNTS_KEY],
    queryFn: () => stockCountsApi.list(),
    enabled,
  });
}

export function useStockCount(id: string): UseQueryResult<StockCount> {
  return useQuery({
    queryKey: [STOCK_COUNTS_KEY, id],
    queryFn: () => stockCountsApi.get(id),
    enabled: id !== "",
  });
}

export function useStartStockCount() {
  return useStockMutation((input: CreateStockCountInput) => stockCountsApi.create(input));
}

export function useRecordCounts() {
  return useStockMutation(({ id, body }: { id: string; body: RecordCountsInput }) =>
    stockCountsApi.record(id, body),
  );
}

export function usePostStockCount() {
  return useStockMutation((id: string) => stockCountsApi.post(id));
}

export function useCancelStockCount() {
  return useStockMutation((id: string) => stockCountsApi.cancel(id));
}
