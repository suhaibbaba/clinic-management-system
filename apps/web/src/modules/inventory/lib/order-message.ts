import { shortDate, type PurchaseRequest } from "@clinic/shared";

export interface OrderSender {
  readonly name: string;
  readonly clinic: string;
}

export function orderMessage(
  request: PurchaseRequest,
  sender: OrderSender,
  translate: (key: string, values?: Record<string, string>) => string,
): string {
  return [
    request.supplierName
      ? translate("inventory.requests.message.greetingNamed", { supplier: request.supplierName })
      : translate("inventory.requests.message.greeting"),
    sender.name
      ? translate("inventory.requests.message.from", { name: sender.name, clinic: sender.clinic })
      : translate("inventory.requests.message.fromClinic", { clinic: sender.clinic }),
    translate("inventory.requests.message.body", { number: request.number }),
    ...(request.neededBy
      ? [translate("inventory.requests.message.neededBy", { date: shortDate(request.neededBy) })]
      : []),
    translate("inventory.requests.message.closing"),
  ].join(" ");
}
