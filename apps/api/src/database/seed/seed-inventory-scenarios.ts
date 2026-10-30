import {
  DEFAULT_TIME_ZONE,
  DISCOUNT_KIND,
  PAYMENT_METHOD,
  addDays,
  localDate,
  type PostPurchaseInput,
  type PurchaseLineInput,
} from "@clinic/shared";
import type { INestApplicationContext } from "@nestjs/common";
import type { AuthenticatedUser } from "@api/common/types/authenticated-user";
import {
  PURCHASE_ROUNDS,
  SCENARIO_ITEMS,
  SCENARIO_SUPPLIERS,
  STOCK_LEVEL,
  type ScenarioItem,
} from "@api/database/seed/inventory-practice";
import { InventoryItemsService } from "@api/modules/inventory/services/inventory-items.service";
import { LotBlocksService } from "@api/modules/inventory/services/lot-blocks.service";
import { PackSizesService } from "@api/modules/inventory/services/pack-sizes.service";
import { PurchaseRequestsService } from "@api/modules/inventory/services/purchase-requests.service";
import { PurchasingService } from "@api/modules/inventory/services/purchasing.service";
import { StockCountsService } from "@api/modules/inventory/services/stock-counts.service";
import { StockMovementsService } from "@api/modules/inventory/services/stock-movements.service";
import { SupplierCreditsService } from "@api/modules/inventory/services/supplier-credits.service";
import { SupplierPaymentsService } from "@api/modules/inventory/services/supplier-payments.service";
import { SuppliersService } from "@api/modules/inventory/services/suppliers.service";
import { WriteOffsService } from "@api/modules/inventory/services/write-offs.service";

export interface InventorySeedActors {
  readonly manager: AuthenticatedUser;
  readonly colleague: AuthenticatedUser | null;
}

export interface InventorySeedReport {
  readonly done: readonly string[];
  readonly failed: readonly string[];
}

interface Seeded {
  readonly item: ScenarioItem;
  readonly id: string;
  readonly packSizeId: string | null;
}

const money = (value: number): string => value.toFixed(2);

const batchOf = (item: ScenarioItem, round: number): string =>
  `${item.key.slice(0, 3).toUpperCase()}-${2401 + round}`;

export async function seedInventoryScenarios(
  app: INestApplicationContext,
  actors: InventorySeedActors,
): Promise<InventorySeedReport> {
  const suppliersService = app.get(SuppliersService);
  const items = app.get(InventoryItemsService);
  const packSizes = app.get(PackSizesService);
  const purchasing = app.get(PurchasingService);
  const payments = app.get(SupplierPaymentsService);
  const credits = app.get(SupplierCreditsService);
  const requests = app.get(PurchaseRequestsService);
  const movements = app.get(StockMovementsService);
  const writeOffs = app.get(WriteOffsService);
  const lotBlocks = app.get(LotBlocksService);
  const counts = app.get(StockCountsService);
  const { manager, colleague } = actors;
  const today = localDate(new Date(), DEFAULT_TIME_ZONE);
  const daysAgo = (days: number): string => addDays(today, -days);
  const done: string[] = [];
  const failed: string[] = [];

  const step = async <T>(label: string, run: () => Promise<T>): Promise<T | null> => {
    try {
      const result = await run();
      done.push(label);
      return result;
    } catch (error) {
      failed.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  };

  const supplierIds: (string | null)[] = [];

  for (const supplier of SCENARIO_SUPPLIERS) {
    const created = await step(`supplier ${supplier.name}`, () =>
      suppliersService.create(manager, {
        name: supplier.name,
        phone: supplier.phone,
        contactPerson: supplier.contactPerson,
        ...(supplier.openingBalance && { openingBalance: supplier.openingBalance }),
      }),
    );
    supplierIds.push(created?.id ?? null);
  }

  const supplierOf = (item: ScenarioItem): string | null =>
    item.supplier === null ? null : (supplierIds[item.supplier] ?? null);

  const seeded: Seeded[] = [];

  for (const item of SCENARIO_ITEMS) {
    const created = await step(`item ${item.name}`, () =>
      items.create(manager, {
        name: item.name,
        category: item.category,
        unit: item.unit,
        minQuantity: String(item.minQuantity),
        defaultSupplierId: supplierOf(item),
        hasExpiry: item.expires === true,
      }),
    );

    if (!created) {
      continue;
    }

    let packSizeId: string | null = null;

    if (item.pack) {
      const pack = item.pack;
      const sizes = await step(`pack size ${item.name}`, () =>
        packSizes.create(manager, created.id, {
          unit: pack.unit,
          unitsPer: pack.unitsPer,
          supplierId: supplierOf(item),
        }),
      );
      packSizeId = sizes?.find((size) => size.unit === pack.unit)?.id ?? null;
    }

    seeded.push({ item, id: created.id, packSizeId });
  }

  const byKey = (key: string): Seeded | undefined => seeded.find((entry) => entry.item.key === key);
  const received = new Map<string, number>();
  const receive = (id: string, quantity: number): void => {
    received.set(id, (received.get(id) ?? 0) + quantity);
  };

  const roundQuantity = (item: ScenarioItem): number =>
    item.pack
      ? Math.max(1, Math.round(item.minQuantity / Number(item.pack.unitsPer)))
      : item.minQuantity;

  for (const [round, plan] of PURCHASE_ROUNDS.entries()) {
    for (const [supplierIndex, supplierId] of supplierIds.entries()) {
      if (!supplierId) {
        continue;
      }

      const own = seeded.filter((entry) => entry.item.supplier === supplierIndex);

      if (own.length === 0) {
        continue;
      }

      const lines: PurchaseLineInput[] = own.map((entry, index) => {
        const { item } = entry;
        const packed = entry.packSizeId !== null;
        const quantity = roundQuantity(item);
        const unitsPer = packed && item.pack ? Number(item.pack.unitsPer) : 1;
        const price = item.unitPrice * unitsPer * (1 + plan.priceRise);
        const free = round === 1 && index === 0 ? 1 : 0;
        const gift = round === 2 && index === own.length - 1 && own.length > 1;

        receive(entry.id, (quantity + free) * unitsPer);

        return {
          itemId: entry.id,
          quantity: String(quantity),
          ...(packed && entry.packSizeId && { packSizeId: entry.packSizeId }),
          ...(free > 0 && { freeQuantity: String(free) }),
          ...(gift ? { gift: true } : { unitPrice: money(price) }),
          ...(round === 1 &&
            index === 1 && { discount: { kind: DISCOUNT_KIND.PERCENT, value: "10" } }),
          ...(item.expires && {
            batchNo: batchOf(item, round),
            expiryDate: addDays(
              today,
              item.key === "articaine" && round === 2 ? 25 : 200 + round * 120,
            ),
          }),
        };
      });

      const input: PostPurchaseInput = {
        supplierId,
        date: daysAgo(plan.daysAgo),
        lines,
        invoice: {
          supplierRef: `INV-${2400 + round * 100 + supplierIndex}`,
          ...(round === 0 && {
            discount: { kind: DISCOUNT_KIND.PERCENT, value: "5" },
            charges: "20",
          }),
          ...(round === 1 && supplierIndex === 2 && { taxRate: "16" }),
          ...(round === 2 && { discount: { kind: DISCOUNT_KIND.AMOUNT, value: "10" } }),
        },
        ...(round > 0 &&
          supplierIndex % 2 === 0 && {
            paidNow: money(round * 50),
            paymentMethod: PAYMENT_METHOD.CASH,
          }),
        note: round === 2 ? "Quarterly restock" : null,
      };

      await step(
        `purchase round ${round + 1} from ${SCENARIO_SUPPLIERS[supplierIndex]?.name}`,
        () => purchasing.post(manager, input),
      );
    }
  }

  const expired = byKey("chlorhexidine");

  if (expired) {
    receive(expired.id, 4);
    await step("expired lot", () =>
      purchasing.post(manager, {
        supplierId: supplierOf(expired.item),
        date: daysAgo(25),
        lines: [
          {
            itemId: expired.id,
            quantity: "4",
            unitPrice: money(expired.item.unitPrice),
            batchNo: "CHX-EXP1",
            expiryDate: daysAgo(10),
          },
        ],
        invoice: { supplierRef: "INV-EXP-1" },
      }),
    );
  }

  const nopaper = supplierIds[1];
  const ejectors = byKey("ejectors");
  const suction = byKey("suction");
  const matrix = byKey("matrix");

  if (nopaper && ejectors && suction && matrix) {
    receive(ejectors.id, 4);
    receive(suction.id, 3);
    receive(matrix.id, 2);
    await step("receipt invoiced later", () =>
      purchasing.post(manager, {
        supplierId: nopaper,
        date: daysAgo(20),
        lines: [
          { itemId: ejectors.id, quantity: "4" },
          { itemId: suction.id, quantity: "3" },
        ],
        note: "Delivered without invoice",
      }),
    );
    await step("receipt still waiting for an invoice", () =>
      purchasing.post(manager, {
        supplierId: nopaper,
        date: daysAgo(5),
        lines: [{ itemId: matrix.id, quantity: "2" }],
        note: "Invoice to follow",
      }),
    );

    const open = await step("uninvoiced lines", () => purchasing.uninvoiced(manager, nopaper));
    const first = open?.filter((line) => line.itemId !== matrix.id) ?? [];

    if (first.length > 0) {
      await step("invoice for an earlier receipt", () =>
        purchasing.invoiceReceipts(manager, {
          supplierId: nopaper,
          date: daysAgo(12),
          supplierRef: "INV-LATE-77",
          lines: first.map((line) => ({
            receiptLineId: line.receiptLineId,
            unitPrice: money(line.itemId === ejectors.id ? 9.5 : 10.5),
          })),
        }),
      );
    }
  }

  const wax = byKey("wax");

  if (wax) {
    receive(wax.id, 3);
    await step("cash purchase without a supplier", () =>
      purchasing.post(manager, {
        date: daysAgo(26),
        lines: [{ itemId: wax.id, quantity: "3" }],
        note: "Bought from a pharmacy nearby",
      }),
    );
  }

  for (const entry of seeded) {
    const { item } = entry;
    const have = received.get(entry.id) ?? 0;
    const keep =
      item.level === STOCK_LEVEL.OUT
        ? 0
        : item.level === STOCK_LEVEL.LOW
          ? Math.floor(item.minQuantity * 0.4)
          : Math.ceil(item.minQuantity * 1.6);
    const use = have - keep;

    if (use <= 0) {
      continue;
    }

    const sessions = Math.min(4, use);
    const each = Math.floor(use / sessions);
    const last = use - each * (sessions - 1);

    for (let session = 0; session < sessions; session += 1) {
      await step(`use ${item.name}`, () =>
        movements.consume(manager, {
          itemId: entry.id,
          quantity: String(session === sessions - 1 ? last : each),
          reason: "Used in treatment",
        }),
      );
    }
  }

  const masks = byKey("masks");
  const compositeA3 = byKey("compositeA3");

  if (expired) {
    await step("write off the expired lot", () =>
      writeOffs.writeOff(manager, {
        itemId: expired.id,
        quantity: "4",
        batchNo: "CHX-EXP1",
        reasonCode: "expired",
        note: "Found expired at the monthly check",
      }),
    );
  }

  if (masks) {
    await step("write off damaged stock", () =>
      writeOffs.writeOff(manager, {
        itemId: masks.id,
        quantity: "1",
        reasonCode: "damaged",
        note: "Box got wet in the store room",
      }),
    );
  }

  if (compositeA3) {
    await step("write off lost stock", () =>
      writeOffs.writeOff(manager, {
        itemId: compositeA3.id,
        quantity: "1",
        batchNo: batchOf(compositeA3.item, 2),
        reasonCode: "lost",
      }),
    );
  }

  const lidocaine = byKey("lidocaine");

  if (lidocaine) {
    await step("block a recalled lot", () =>
      lotBlocks.block(manager, lidocaine.id, {
        batchNo: batchOf(lidocaine.item, 2),
        reason: "Supplier recall notice — hold until confirmed",
      }),
    );
  }

  const amoxicillin = byKey("amoxicillin");
  const pharmacy = supplierIds[2];

  if (amoxicillin && pharmacy) {
    await step("return to supplier with a credit note", () =>
      credits.returnToSupplier(manager, {
        supplierId: pharmacy,
        date: daysAgo(15),
        lines: [{ itemId: amoxicillin.id, quantity: "1", batchNo: batchOf(amoxicillin.item, 2) }],
        credit: { amount: "24.20", supplierRef: "CN-310" },
        note: "Wrong strength delivered",
      }),
    );
  }

  const paymentPlan: readonly { supplier: number; days: number; amount: string; method: string }[] =
    [
      { supplier: 0, days: 27, amount: "600.00", method: PAYMENT_METHOD.TRANSFER },
      { supplier: 0, days: 18, amount: "400.00", method: PAYMENT_METHOD.CASH },
      { supplier: 1, days: 19, amount: "250.00", method: PAYMENT_METHOD.CASH },
      { supplier: 2, days: 16, amount: "300.00", method: PAYMENT_METHOD.TRANSFER },
      { supplier: 3, days: 13, amount: "900.00", method: PAYMENT_METHOD.TRANSFER },
      { supplier: 3, days: 4, amount: "350.00", method: PAYMENT_METHOD.CASH },
      { supplier: 4, days: 11, amount: "2000.00", method: PAYMENT_METHOD.TRANSFER },
    ];

  for (const plan of paymentPlan) {
    const supplierId = supplierIds[plan.supplier];

    if (supplierId) {
      await step(`payment to ${SCENARIO_SUPPLIERS[plan.supplier]?.name}`, () =>
        payments.create(manager, {
          supplierId,
          paidOn: daysAgo(plan.days),
          amount: plan.amount,
          method: plan.method,
        }),
      );
    }
  }

  const overpaid = supplierIds[4];

  if (overpaid) {
    await step("refund an overpayment", () =>
      payments.refund(manager, {
        supplierId: overpaid,
        amount: "150.00",
        method: PAYMENT_METHOD.TRANSFER,
        paidOn: daysAgo(6),
        note: "Paid twice for one invoice",
      }),
    );
  }

  const requestFor = async (
    label: string,
    supplier: number,
    keys: readonly string[],
    neededIn: number,
  ) => {
    const supplierId = supplierIds[supplier];
    const lines = keys.flatMap((key) => {
      const entry = byKey(key);
      return entry ? [{ itemId: entry.id, quantity: String(roundQuantity(entry.item) * 2) }] : [];
    });

    return lines.length > 0
      ? step(label, () =>
          requests.create(manager, {
            supplierId,
            neededBy: addDays(today, neededIn),
            lines,
          }),
        )
      : null;
  };

  await requestFor("open request", 0, ["glovesM", "masks", "disinfectant"], 7);
  await requestFor("request to a supplier without a phone", 5, ["sanitizer"], 14);

  const ordered = await requestFor("request sent to the supplier", 3, ["compositeA2", "etch"], 5);

  if (ordered) {
    await step("mark request as ordered", () =>
      requests.markOrdered(manager, ordered.id, SCENARIO_SUPPLIERS[3]?.phone ?? null),
    );
  }

  const partly = await requestFor("request received in part", 2, ["articaine", "ibuprofen"], 3);

  if (partly && pharmacy) {
    await step("mark partial request as ordered", () => requests.markOrdered(manager, partly.id));
    const [first] = partly.lines;
    const entry = first ? seeded.find((candidate) => candidate.id === first.itemId) : undefined;

    if (first && entry) {
      await step("receive part of a request", () =>
        purchasing.post(manager, {
          supplierId: pharmacy,
          date: daysAgo(2),
          lines: [
            {
              itemId: first.itemId,
              requestLineId: first.id,
              quantity: String(Math.max(1, Math.floor(Number(first.quantity) / 2))),
              unitPrice: money(entry.item.unitPrice * 1.1),
              batchNo: batchOf(entry.item, 3),
              expiryDate: addDays(today, 500),
            },
          ],
          invoice: { supplierRef: "INV-PART-12" },
        }),
      );
    }
  }

  const full = await requestFor("request received in full", 1, ["bibs"], -10);
  const nour = supplierIds[1];

  if (full && nour) {
    await step("mark full request as ordered", () => requests.markOrdered(manager, full.id));
    await step("receive a whole request", () =>
      purchasing.post(manager, {
        supplierId: nour,
        date: daysAgo(8),
        lines: full.lines.map((line) => ({
          itemId: line.itemId,
          requestLineId: line.id,
          quantity: line.quantity,
          unitPrice: "15.50",
        })),
        invoice: { supplierRef: "INV-FULL-9" },
      }),
    );
  }

  const cancelled = await requestFor("request later cancelled", 4, ["files", "alginate"], 10);

  if (cancelled) {
    await step("cancel a request", () =>
      requests.cancel(manager, cancelled.id, "Found a better price elsewhere"),
    );
  }

  if (colleague) {
    const gloves = byKey("glovesS");
    const pouches = byKey("pouches");
    const shifa = supplierIds[0];

    if (gloves && pouches && shifa) {
      await step("purchase posted by a colleague", () =>
        purchasing.post(colleague, {
          supplierId: shifa,
          date: daysAgo(2),
          lines: [
            { itemId: gloves.id, quantity: "4", unitPrice: "17.50" },
            { itemId: pouches.id, quantity: "2", unitPrice: "26.00" },
          ],
          invoice: { supplierRef: "INV-COL-1" },
        }),
      );
      await step("receipt posted by a colleague", () =>
        purchasing.post(colleague, {
          supplierId: shifa,
          date: daysAgo(1),
          lines: [{ itemId: gloves.id, quantity: "2" }],
          note: "Urgent top-up",
        }),
      );
    }
  }

  const countKeys = ["glovesL", "gauze", "burs", "pouches", "sanitizer"];
  const counted = countKeys.flatMap((key) => {
    const entry = byKey(key);
    return entry ? [entry] : [];
  });

  if (counted.length > 0) {
    const finished = await step("stock count", () =>
      counts.create(manager, {
        itemIds: counted.map((entry) => entry.id),
        note: "Monthly count",
      }),
    );

    if (finished) {
      await step("record counted quantities", () =>
        counts.recordCounts(manager, finished.id, {
          lines: finished.lines.map((line, index) => ({
            itemId: line.itemId,
            counted: String(
              Math.max(0, Number(line.expected) + (index % 3 === 0 ? -1 : index % 3)),
            ),
          })),
        }),
      );
      await step("post the stock count", () => counts.post(manager, finished.id));
    }

    const ongoing = await step("count in progress", () =>
      counts.create(manager, {
        itemIds: counted.slice(0, 3).map((entry) => entry.id),
        note: "Spot check",
      }),
    );
    const firstLine = ongoing?.lines[0];

    if (ongoing && firstLine) {
      await step("record part of a count", () =>
        counts.recordCounts(manager, ongoing.id, {
          lines: [{ itemId: firstLine.itemId, counted: firstLine.expected }],
        }),
      );
    }
  }

  return { done, failed };
}
