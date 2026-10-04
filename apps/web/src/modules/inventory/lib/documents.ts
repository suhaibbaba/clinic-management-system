import { inventoryApi } from "@web/modules/inventory/api";
import type { DocumentSource } from "@web/shared/lib/document-source";

export const shoppingListSource = (maySend: boolean): DocumentSource => ({
  load: () => inventoryApi.shoppingListPdf(),
  filename: "shopping-list.pdf",
  recipient: null,
  send: maySend ? (to) => inventoryApi.sendShoppingList(to) : undefined,
});
