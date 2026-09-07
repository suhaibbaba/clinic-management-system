import type {
  AdjustStockInput,
  ConsumeStockInput,
  CreateInventoryItemInput,
  CreateSupplierInput,
  InventoryAlerts,
  InventoryItem,
  InventoryItemRow,
  ItemBatches,
  ListInventoryItemsQuery,
  ListMovementsQuery,
  ListSuppliersQuery,
  Paginated,
  PurchaseStockInput,
  ReverseMovementInput,
  ShoppingList,
  StatementRangeQuery,
  StockMovement,
  StockMovementRow,
  Supplier,
  SupplierStatement,
  SupplierSummary,
  UpdateInventoryItemInput,
  UpdateSupplierInput,
} from '@clinic/shared';

import { apiDownload, apiRequest } from '@web/lib/api-client';

const query = (params: Record<string, string | number | boolean | undefined>): string => {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  return search.size > 0 ? `?${search.toString()}` : '';
};

export const inventoryApi = {
  /* -------------------------------- Items ------------------------------- */

  items: (params: Partial<ListInventoryItemsQuery> = {}) =>
    apiRequest<Paginated<InventoryItemRow>>(`/inventory/items${query(params)}`),

  item: (id: string) => apiRequest<InventoryItemRow>(`/inventory/items/${id}`),

  createItem: (body: CreateInventoryItemInput) =>
    apiRequest<InventoryItem>('/inventory/items', { method: 'POST', body }),

  updateItem: (id: string, body: UpdateInventoryItemInput) =>
    apiRequest<InventoryItem>(`/inventory/items/${id}`, { method: 'PATCH', body }),

  /** What is left of each batch — derived on read, never stored. */
  batches: (id: string) => apiRequest<ItemBatches>(`/inventory/items/${id}/batches`),

  /* ------------------------------ Movements ----------------------------- */

  movements: (params: Partial<ListMovementsQuery> = {}) =>
    apiRequest<Paginated<StockMovementRow>>(`/inventory/movements${query(params)}`),

  /** The item card: this item's history with a running quantity. */
  itemMovements: (id: string, params: Partial<ListMovementsQuery> = {}) =>
    apiRequest<Paginated<StockMovementRow>>(`/inventory/items/${id}/movements${query(params)}`),

  /**
   * One call per act, matching the API.
   *
   * Not one `move(type, …)`: the three carry different fields and different
   * permissions, and a single call would have to accept the union of both.
   */
  purchase: (body: PurchaseStockInput) =>
    apiRequest<StockMovement>('/inventory/movements/purchase', { method: 'POST', body }),

  consume: (body: ConsumeStockInput) =>
    apiRequest<StockMovement>('/inventory/movements/consume', { method: 'POST', body }),

  adjust: (body: AdjustStockInput) =>
    apiRequest<StockMovement>('/inventory/movements/adjust', { method: 'POST', body }),

  reverse: (id: string, body: ReverseMovementInput) =>
    apiRequest<StockMovement>(`/inventory/movements/${id}/reverse`, { method: 'PATCH', body }),

  /* ------------------------- Alerts and the list ------------------------ */

  alerts: () => apiRequest<InventoryAlerts>('/inventory/alerts'),

  shoppingList: () => apiRequest<ShoppingList>('/inventory/shopping-list'),

  shoppingListPdf: (): Promise<Blob> => apiDownload('/inventory/shopping-list.pdf'),
};

export const suppliersApi = {
  list: (params: Partial<ListSuppliersQuery> = {}) =>
    apiRequest<Paginated<SupplierSummary>>(`/suppliers${query(params)}`),

  findOne: (id: string) => apiRequest<SupplierSummary>(`/suppliers/${id}`),

  create: (body: CreateSupplierInput) =>
    apiRequest<Supplier>('/suppliers', { method: 'POST', body }),

  update: (id: string, body: UpdateSupplierInput) =>
    apiRequest<Supplier>(`/suppliers/${id}`, { method: 'PATCH', body }),

  statement: (id: string, params: StatementRangeQuery) =>
    apiRequest<SupplierStatement>(`/suppliers/${id}/statement${query({ ...params })}`),
};
