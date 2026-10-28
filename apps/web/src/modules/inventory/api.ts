import { toQueryString } from "@web/shared/lib/query-string";
import type {
  AdjustStockInput,
  CreatePackSizeInput,
  ItemPrice,
  PackSize,
  ReportRangeQuery,
  Valuation,
  VarianceReport,
  WasteReport,
  MarkReviewedInput,
  PurchaseReviewEntry,
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
  ListLotBlocksQuery,
  LotBlock,
  PriceDocumentInput,
  SupplierReturnInput,
  SupplierReturnResult,
  WriteOffInput,
  ConsumeStockInput,
  CreateInventoryItemInput,
  CreateSupplierInput,
  CreateSupplierPaymentInput,
  InventoryAlerts,
  InvoiceReceiptsInput,
  PostPurchaseInput,
  PurchaseResult,
  SupplierInvoiceSummary,
  UninvoicedLine,
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
  SupplierPayment,
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

  packSizes: (itemId: string) => apiRequest<PackSize[]>(`/inventory/items/${itemId}/pack-sizes`),

  addPackSize: (itemId: string, body: CreatePackSizeInput) =>
    apiRequest<PackSize[]>(`/inventory/items/${itemId}/pack-sizes`, { method: "POST", body }),

  archivePackSize: (id: string) =>
    apiRequest<void>(`/inventory/pack-sizes/${id}/archive`, { method: "PATCH" }),

  itemPrices: (itemId: string) => apiRequest<ItemPrice[]>(`/inventory/items/${itemId}/prices`),

  valuation: (date: string) =>
    apiRequest<Valuation>(`/inventory/reports/valuation${toQueryString({ date })}`),

  waste: (range: ReportRangeQuery) =>
    apiRequest<WasteReport>(`/inventory/reports/waste${toQueryString(range)}`),

  variance: (range: ReportRangeQuery) =>
    apiRequest<VarianceReport>(`/inventory/reports/variance${toQueryString(range)}`),

  writeOff: (body: WriteOffInput) =>
    apiRequest<StockMovement>("/inventory/movements/write-off", { method: "POST", body }),

  lotBlocks: (params: Partial<ListLotBlocksQuery> = {}) =>
    apiRequest<LotBlock[]>(`/inventory/lot-blocks${toQueryString(params)}`),

  blockLot: (itemId: string, body: BlockLotInput) =>
    apiRequest<LotBlock>(`/inventory/items/${itemId}/lot-blocks`, { method: "POST", body }),

  liftLotBlock: (id: string, reason: string) =>
    apiRequest<LotBlock>(`/inventory/lot-blocks/${id}/lift`, {
      method: "PATCH",
      body: { reason },
    }),

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

  pay: (body: CreateSupplierPaymentInput) =>
    apiRequest<SupplierPayment>("/supplier-payments", { method: "POST", body }),

  invoices: (id: string) => apiRequest<SupplierInvoiceSummary[]>(`/suppliers/${id}/invoices`),

  uninvoiced: (id: string) => apiRequest<UninvoicedLine[]>(`/suppliers/${id}/uninvoiced`),

  voidInvoice: (id: string, reason: string) =>
    apiRequest<void>(`/purchases/invoices/${id}/void`, { method: "PATCH", body: { reason } }),

  reversePayment: (id: string, reason: string) =>
    apiRequest<SupplierPayment>(`/supplier-payments/${id}/reverse`, {
      method: "PATCH",
      body: { reason },
    }),
};

export const purchasesApi = {
  post: (body: PostPurchaseInput) =>
    apiRequest<PurchaseResult>("/purchases", { method: "POST", body }),

  invoiceReceipts: (body: InvoiceReceiptsInput) =>
    apiRequest<SupplierInvoiceSummary>("/purchases/invoices", { method: "POST", body }),

  returnToSupplier: (body: SupplierReturnInput) =>
    apiRequest<SupplierReturnResult>("/purchases/returns", { method: "POST", body }),

  review: () => apiRequest<PurchaseReviewEntry[]>("/purchases/review"),

  markReviewed: (body: MarkReviewedInput) =>
    apiRequest<void>("/purchases/review", { method: "PATCH", body }),

  creditNote: (body: PriceDocumentInput) =>
    apiRequest<SupplierInvoiceSummary>("/purchases/credit-notes", { method: "POST", body }),
};

export const purchaseRequestsApi = {
  list: (params: Partial<ListPurchaseRequestsQuery> = {}) =>
    apiRequest<Paginated<PurchaseRequest>>(`/purchase-requests${toQueryString(params)}`),

  get: (id: string) => apiRequest<PurchaseRequest>(`/purchase-requests/${id}`),

  create: (body: CreatePurchaseRequestInput) =>
    apiRequest<PurchaseRequest>("/purchase-requests", { method: "POST", body }),

  belowMinimum: () =>
    apiRequest<PurchaseRequest[]>("/purchase-requests/below-minimum", {
      method: "POST",
      body: {},
    }),

  update: (id: string, body: UpdatePurchaseRequestInput) =>
    apiRequest<PurchaseRequest>(`/purchase-requests/${id}`, { method: "PUT", body }),

  send: (id: string, body: SendPurchaseRequestInput) =>
    apiRequest<PurchaseRequest>(`/purchase-requests/${id}/send`, { method: "POST", body }),

  markOrdered: (id: string) =>
    apiRequest<PurchaseRequest>(`/purchase-requests/${id}/ordered`, { method: "PATCH" }),

  close: (id: string) =>
    apiRequest<PurchaseRequest>(`/purchase-requests/${id}/close`, { method: "PATCH" }),

  cancel: (id: string, reason: string) =>
    apiRequest<PurchaseRequest>(`/purchase-requests/${id}/cancel`, {
      method: "PATCH",
      body: { reason },
    }),
};

export const stockCountsApi = {
  list: () => apiRequest<StockCountSummary[]>("/stock-counts"),

  get: (id: string) => apiRequest<StockCount>(`/stock-counts/${id}`),

  create: (body: CreateStockCountInput) =>
    apiRequest<StockCount>("/stock-counts", { method: "POST", body }),

  record: (id: string, body: RecordCountsInput) =>
    apiRequest<StockCount>(`/stock-counts/${id}/lines`, { method: "PUT", body }),

  post: (id: string) => apiRequest<StockCount>(`/stock-counts/${id}/post`, { method: "POST" }),

  cancel: (id: string) => apiRequest<StockCount>(`/stock-counts/${id}/cancel`, { method: "PATCH" }),
};
