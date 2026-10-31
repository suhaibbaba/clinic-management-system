import { PURCHASE_REQUEST_STATUS, type PurchaseRequest } from "@clinic/shared";
import type { IconName } from "@clinic/ui/components/icon";

export interface RequestAction {
  readonly key: string;
  readonly icon: IconName;
  readonly label: string;
  readonly danger?: boolean;
  readonly run: () => void;
}

export const isOpenRequest = (request: PurchaseRequest): boolean =>
  request.status === PURCHASE_REQUEST_STATUS.REQUESTED ||
  request.status === PURCHASE_REQUEST_STATUS.ORDERED ||
  request.status === PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED;
