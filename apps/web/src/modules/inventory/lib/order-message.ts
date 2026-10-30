import { shortDate, type PurchaseRequest } from "@clinic/shared";

export interface OrderMessageWords {
  readonly translate: (key: string, values: Record<string, string>) => string;
  readonly unitLabel: (code: string) => string;
  readonly price: ((amount: string) => string) | null;
}

export function orderMessage(request: PurchaseRequest, words: OrderMessageWords): string {
  const lines = request.lines.map((line) => {
    const values = {
      item: line.itemName,
      quantity: String(Number(line.quantity)),
      unit: words.unitLabel(line.unit),
    };

    return `• ${
      words.price && line.lastPrice
        ? words.translate("inventory.requests.message.linePriced", {
            ...values,
            price: words.price(line.lastPrice),
          })
        : words.translate("inventory.requests.message.line", values)
    }`;
  });

  return [
    words.translate("inventory.requests.message.title", { number: request.number }),
    ...lines,
    ...(request.neededBy
      ? [
          words.translate("inventory.requests.message.neededBy", {
            date: shortDate(request.neededBy),
          }),
        ]
      : []),
    ...(request.note ? [request.note] : []),
  ].join("\n");
}

export function whatsappLink(phone: string, text: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
