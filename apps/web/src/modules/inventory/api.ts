import { toQueryString } from "@web/shared/lib/query-string";
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
} from "@clinic/shared";
import { apiDownload, apiRequest } from "@web/shared/lib/api-client";

export const inventoryApi = {
  items: (params: Partial<ListInventoryItemsQuery> = {}) =>
    apiRequest<Paginated<InventoryItemRow>>(`/inventory/items${toQueryString(params)}`),

  item: (id: string) => apiRequest<InventoryItemRow>(`/inventory/items/${id}`),

  createItem: (body: CreateInventoryItemInput) =>
    apiRequest<InventoryItem>("/inventory/items", { method: "POST", body }),

  updateItem: (id: string, body: UpdateInventoryItemInput) =>
    apiRequest<InventoryItem>(`/inventory/items/${id}`, { method: "PATCH", body }),

  removeItem: (id: string) => apiRequest<void>(`/inventory/items/${id}`, { method: "DELETE" }),

  batches: (id: string) => apiRequest<ItemBatches>(`/inventory/items/${id}/batches`),

  movements: (params: Partial<ListMovementsQuery> = {}) =>
    apiRequest<Paginated<StockMovementRow>>(`/inventory/movements${toQueryString(params)}`),

  itemMovements: (id: string, params: Partial<ListMovementsQuery> = {}) =>
    apiRequest<Paginated<StockMovementRow>>(
      `/inventory/items/${id}/movements${toQueryString(params)}`,
    ),

  purchase: (body: PurchaseStockInput) =>
    apiRequest<StockMovement>("/inventory/movements/purchase", { method: "POST", body }),

  consume: (body: ConsumeStockInput) =>
    apiRequest<StockMovement>("/inventory/movements/consume", { method: "POST", body }),

  adjust: (body: AdjustStockInput) =>
    apiRequest<StockMovement>("/inventory/movements/adjust", { method: "POST", body }),

  reverse: (id: string, body: ReverseMovementInput) =>
    apiRequest<StockMovement>(`/inventory/movements/${id}/reverse`, { method: "PATCH", body }),

  alerts: () => apiRequest<InventoryAlerts>("/inventory/alerts"),

  shoppingList: () => apiRequest<ShoppingList>("/inventory/shopping-list"),

  shoppingListPdf: (): Promise<Blob> => apiDownload("/inventory/shopping-list.pdf"),

  sendShoppingList: (to: string): Promise<void> =>
    apiRequest("/inventory/shopping-list/whatsapp", { method: "POST", body: { to } }),
};

export const suppliersApi = {
  list: (params: Partial<ListSuppliersQuery> = {}) =>
    apiRequest<Paginated<SupplierSummary>>(`/suppliers${toQueryString(params)}`),

  findOne: (id: string) => apiRequest<SupplierSummary>(`/suppliers/${id}`),

  create: (body: CreateSupplierInput) =>
    apiRequest<Supplier>("/suppliers", { method: "POST", body }),

  update: (id: string, body: UpdateSupplierInput) =>
    apiRequest<Supplier>(`/suppliers/${id}`, { method: "PATCH", body }),

  remove: (id: string) => apiRequest<void>(`/suppliers/${id}`, { method: "DELETE" }),

  statement: (id: string, params: StatementRangeQuery) =>
    apiRequest<SupplierStatement>(`/suppliers/${id}/statement${toQueryString({ ...params })}`),
};
