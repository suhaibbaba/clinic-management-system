import { PURCHASE_REQUEST_STATUS, type PurchaseRequest } from "@clinic/shared";
import { useState, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@clinic/ui";
import { errorToast } from "@web/shared/lib/api-error";
import { useSession } from "@web/shared/providers/session";
import {
  canManagePurchaseRequest,
  canPostPurchase,
  canRequestPurchase,
  canSeeCosts,
  canSendPurchaseRequest,
} from "@web/shared/permissions/inventory";
import { useCloseRequest } from "@web/modules/inventory/queries";
import { ORDER_PARAM } from "@web/modules/inventory/constants";
import { isOpenRequest, type RequestAction } from "@web/modules/inventory/lib/request-actions";
import { SendRequestModal } from "@web/modules/inventory/components/send-request-modal";
import { CancelRequestModal } from "@web/modules/inventory/components/cancel-request-modal";

export function useRequestActions(): {
  readonly actionsFor: (request: PurchaseRequest) => readonly RequestAction[];
  readonly dialogs: JSX.Element;
} {
  const toast = useToast();
  const navigate = useNavigate();
  const { can } = useSession();
  const close = useCloseRequest();
  const [sending, setSending] = useState<PurchaseRequest | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const mayRequest = canRequestPurchase(can);
  const maySend = canSendPurchaseRequest(can);
  const mayManage = canManagePurchaseRequest(can);
  const mayReceive = canPostPurchase(can);

  const closeRemainder = async (id: string): Promise<void> => {
    try {
      await close.mutateAsync(id);
      toast.success("inventory.requests.closed");
    } catch (error) {
      toast.error(...errorToast(error));
    }
  };

  const actionsFor = (request: PurchaseRequest): readonly RequestAction[] => {
    if (!isOpenRequest(request)) {
      return [];
    }

    const partly = request.status === PURCHASE_REQUEST_STATUS.PARTLY_RECEIVED;
    const actions: RequestAction[] = [];

    if (mayReceive) {
      actions.push({
        key: "receive",
        icon: "package",
        label: "inventory.requests.receive",
        run: () => void navigate(`/inventory/purchases/new?request=${request.id}`),
      });
    }
    if (maySend && request.supplierId) {
      actions.push({
        key: "send",
        icon: "whatsapp",
        label: request.sentAt ? "inventory.requests.sendUpdate" : "inventory.requests.send",
        run: () => setSending(request),
      });
    }
    if (mayRequest && !partly) {
      actions.push({
        key: "edit",
        icon: "edit",
        label: "common.edit",
        run: () => void navigate(`/inventory/purchases/new?${ORDER_PARAM}=${request.id}`),
      });
    }
    if (mayManage && partly) {
      actions.push({
        key: "close",
        icon: "check",
        label: "inventory.requests.closeRemainder",
        run: () => void closeRemainder(request.id),
      });
    }
    if (mayManage) {
      actions.push({
        key: "cancel",
        icon: "x",
        label: "inventory.requests.cancel",
        danger: true,
        run: () => setCancelling(request.id),
      });
    }

    return actions;
  };

  return {
    actionsFor,
    dialogs: (
      <>
        <SendRequestModal
          request={sending}
          mayShowPrices={canSeeCosts(can)}
          onClose={() => setSending(null)}
        />
        <CancelRequestModal requestId={cancelling} onClose={() => setCancelling(null)} />
      </>
    ),
  };
}
