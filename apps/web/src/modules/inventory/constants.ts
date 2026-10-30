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

export type UsageMovementType = Exclude<RecordableMovementType, typeof MOVEMENT_TYPE.PURCHASE>;

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

export const REQUESTS_PATH = "/inventory/requests";

export const COUNT_FILTERS = ["all", "remaining", "differences"] as const;

export type CountFilter = (typeof COUNT_FILTERS)[number];

export const STOCK_DOT: Record<ProgressTone, string> = {
  primary: "bg-primary-600",
  success: "bg-success-600",
  warning: "bg-warning-500",
  danger: "bg-danger-600",
};

export type PurchaseLineLayout = "invoice" | "priced" | "plain";

const PRICED_LINE_GRID = [
  "@min-[40rem]:grid-cols-[minmax(6rem,360px)_4rem_4rem_7.5rem_140px_6.5rem_5.75rem]",
  "@min-[56rem]:grid-cols-[minmax(9rem,360px)_5.5rem_5.5rem_7.5rem_140px_6.5rem_5.75rem]",
  "@min-[60rem]:grid-cols-[minmax(6rem,360px)_minmax(132px,160px)_5rem_5rem_7.5rem_140px_6.5rem_5.75rem]",
].join(" ");

export const PURCHASE_LINE_GRID: Record<PurchaseLineLayout, string> = {
  invoice: PRICED_LINE_GRID,
  priced: PRICED_LINE_GRID,
  plain: [
    "@min-[40rem]:grid-cols-[minmax(8rem,360px)_minmax(132px,160px)_4rem_4rem_5.75rem]",
    "@min-[56rem]:grid-cols-[minmax(9rem,360px)_minmax(132px,160px)_5.5rem_5.5rem_5.75rem]",
  ].join(" "),
};

export const PURCHASE_UNIT_COLUMN: Record<
  PurchaseLineLayout,
  { readonly cell: string; readonly column: string }
> = {
  invoice: { cell: "@min-[60rem]:contents", column: "hidden @min-[60rem]:block" },
  priced: { cell: "@min-[60rem]:contents", column: "hidden @min-[60rem]:block" },
  plain: { cell: "@min-[40rem]:contents", column: "hidden @min-[40rem]:block" },
};

export const EXPIRY_MIN_DAYS_AHEAD = 2;

export const OPEN_ORDER_WAIT_SECONDS = 10;

export const PURCHASE_MODES = ["receive", "order"] as const;

export type PurchaseMode = (typeof PURCHASE_MODES)[number];

export const MODE_PARAM = "mode";

export const ORDER_PARAM = "order";

export const REQUESTS_TAB_PATH = "/inventory?tab=requests";

export const PICK_PARAM = "pick";

export const RETURN_PARAM = "return";

export const SHOPPING_LIST_PATH = "/inventory/shopping-list";
