import type { MovementType } from "@clinic/shared";
import type { IconName } from "@clinic/ui/components/icon";
import { MOVEMENT_TYPE } from "@clinic/shared";

export const INVENTORY_TAB_STOCK = "stock";

export const INVENTORY_TAB_SUPPLIERS = "suppliers";

export const ITEM_PAGE_TABS = ["overview", "movements"] as const;

export const MOVEMENT_ACTION_ICONS: Record<MovementType, IconName> = {
  [MOVEMENT_TYPE.PURCHASE]: "plus",
  [MOVEMENT_TYPE.CONSUME]: "trend-down",
  [MOVEMENT_TYPE.ADJUST]: "clipboard",
};

export const MOVEMENT_ACTIONS: readonly MovementType[] = [
  MOVEMENT_TYPE.PURCHASE,
  MOVEMENT_TYPE.CONSUME,
  MOVEMENT_TYPE.ADJUST,
];

export const UNBATCHED_ROW_KEY = "unbatched";

export const ALERT_PREVIEW_COUNT = 2;

export const MOVEMENTS_DEFAULT_MONTHS = 3;
