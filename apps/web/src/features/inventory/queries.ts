import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type {
  AdjustStockInput,
  ConsumeStockInput,
  CreateInventoryItemInput,
  CreateSupplierInput,
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
} from '@clinic/shared';

import { inventoryApi, suppliersApi } from '@web/features/inventory/api';

export const ITEMS_KEY = 'inventory-items';
export const MOVEMENTS_KEY = 'stock-movements';
export const BATCHES_KEY = 'item-batches';
export const ALERTS_KEY = 'inventory-alerts';
export const SHOPPING_LIST_KEY = 'shopping-list';
export const SUPPLIERS_KEY = 'suppliers';
export const SUPPLIER_STATEMENT_KEY = 'supplier-statement';

// One purchase moves the quantity, the batches, the low flag, the alerts, the shopping list and the
// supplier's total, so a write invalidates all of them.
const STOCK_KEYS = [
  ITEMS_KEY,
  MOVEMENTS_KEY,
  BATCHES_KEY,
  ALERTS_KEY,
  SHOPPING_LIST_KEY,
  SUPPLIERS_KEY,
  SUPPLIER_STATEMENT_KEY,
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
    queryKey: [ITEMS_KEY, 'one', id],
    queryFn: () => inventoryApi.item(id),
    enabled: id !== '',
  });
}

export function useItemBatches(id: string): UseQueryResult<ItemBatches> {
  return useQuery({
    queryKey: [BATCHES_KEY, id],
    queryFn: () => inventoryApi.batches(id),
    enabled: id !== '',
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
    enabled: id !== '',
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

export function useSupplierStatement(
  id: string,
  query: StatementRangeQuery,
): UseQueryResult<SupplierStatement> {
  return useQuery({
    queryKey: [SUPPLIER_STATEMENT_KEY, id, query],
    queryFn: () => suppliersApi.statement(id, query),
    placeholderData: (previous) => previous,
    enabled: id !== '',
  });
}

export function useCreateItem() {
  return useStockMutation((input: CreateInventoryItemInput) => inventoryApi.createItem(input));
}

export function useUpdateItem() {
  return useStockMutation(({ id, body }: { id: string; body: UpdateInventoryItemInput }) =>
    inventoryApi.updateItem(id, body),
  );
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
