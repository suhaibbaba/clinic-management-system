import type { TabDefinition } from "@clinic/ui";
import {
  type PurchaseRequestStatus,
  type RecordableMovementType,
  MOVEMENT_TYPE,
  PURCHASE_REQUEST_STATUS,
} from "@clinic/shared";
import type { BadgeTone } from "@clinic/ui/components/badge";
import type { ProgressTone } from "@clinic/ui/components/progress-bar";
import type { IconName } from "@clinic/ui/components/icon";

export const INVENTORY_TAB_STOCK = "stock";

export const INVENTORY_TAB_SUPPLIERS = "suppliers";

export const INVENTORY_TAB_REQUESTS = "requests";

export const INVENTORY_TAB_REVIEW = "review";

export const INVENTORY_TAB_REPORTS = "reports";

export const STOCK_REPORTS = ["valuation", "waste", "variance"] as const;

export type StockReport = (typeof STOCK_REPORTS)[number];

export const SUPPLIERS_TAB_PATH = "/inventory?tab=suppliers";

export const ITEM_PAGE_TABS = ["overview", "movements", "prices"] as const;

export const MOVEMENT_ACTION_ICONS: Record<RecordableMovementType, IconName> = {
  [MOVEMENT_TYPE.PURCHASE]: "plus",
  [MOVEMENT_TYPE.CONSUME]: "trend-down",
  [MOVEMENT_TYPE.ADJUST]: "clipboard",
};

export const MOVEMENT_ACTIONS: readonly RecordableMovementType[] = [
  MOVEMENT_TYPE.PURCHASE,
  MOVEMENT_TYPE.CONSUME,
  MOVEMENT_TYPE.ADJUST,
];

export const UNBATCHED_ROW_KEY = "unbatched";

export type InventoryTab =
  | typeof INVENTORY_TAB_STOCK
  | typeof INVENTORY_TAB_REQUESTS
  | typeof INVENTORY_TAB_SUPPLIERS
  | typeof INVENTORY_TAB_REVIEW
  | typeof INVENTORY_TAB_REPORTS;

export const INVENTORY_TABS: readonly TabDefinition<InventoryTab>[] = [
  { id: INVENTORY_TAB_STOCK, label: "inventory.section.stock" },
  { id: INVENTORY_TAB_REQUESTS, label: "inventory.section.requests" },
  { id: INVENTORY_TAB_SUPPLIERS, label: "inventory.section.suppliers" },
  { id: INVENTORY_TAB_REPORTS, label: "inventory.section.reports" },
  { id: INVENTORY_TAB_REVIEW, label: "inventory.section.review" },
];

export const REQUEST_STATUS_TONES: Record<PurchaseRequestStatus, BadgeTone> = {
  [PURCHASE_REQUEST_STATUS.REQUESTED]: "neutral",
  [PURCHASE_REQUEST_STATUS.ORDERED]: "info",
  [PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED]: "warning",
  [PURCHASE_REQUEST_STATUS.RECEIVED]: "success",
  [PURCHASE_REQUEST_STATUS.CLOSED]: "neutral",
  [PURCHASE_REQUEST_STATUS.CANCELLED]: "danger",
};

export const REQUEST_FILTERS = [
  "all",
  PURCHASE_REQUEST_STATUS.REQUESTED,
  PURCHASE_REQUEST_STATUS.ORDERED,
  PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED,
  PURCHASE_REQUEST_STATUS.RECEIVED,
] as const;

export type RequestFilter = (typeof REQUEST_FILTERS)[number];

export const STOCK_COUNT_PATH = "/inventory/counts";

export const STOCK_DOT: Record<ProgressTone, string> = {
  primary: "bg-primary-600",
  success: "bg-success-600",
  warning: "bg-warning-500",
  danger: "bg-danger-600",
};

export const PURCHASE_LINE_GRID = {
  invoice: [
    "@min-[40rem]:grid-cols-[minmax(8rem,1fr)_4rem_4rem_5.5rem_140px_4.5rem_4.75rem]",
    "@min-[56rem]:grid-cols-[minmax(9rem,1.4fr)_5.5rem_5.5rem_7.5rem_140px_minmax(5rem,0.5fr)_4.75rem]",
  ].join(" "),
  priced: [
    "@min-[40rem]:grid-cols-[minmax(8rem,1fr)_4rem_4rem_5.5rem_4.75rem]",
    "@min-[56rem]:grid-cols-[minmax(9rem,1fr)_5.5rem_5.5rem_7.5rem_4.75rem]",
  ].join(" "),
  plain: [
    "@min-[40rem]:grid-cols-[minmax(8rem,1fr)_4rem_4rem_4.75rem]",
    "@min-[56rem]:grid-cols-[minmax(9rem,1fr)_5.5rem_5.5rem_4.75rem]",
  ].join(" "),
} as const;

export type PurchaseLineLayout = keyof typeof PURCHASE_LINE_GRID;

export const EXPIRY_MIN_DAYS_AHEAD = 2;
