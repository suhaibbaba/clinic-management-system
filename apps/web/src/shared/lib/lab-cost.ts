import {
  LAB_ORDER_STATUS,
  addMoney,
  subtractMoney,
  type LabOrder,
  type Money,
} from "@clinic/shared";

type CostedOrder = Pick<LabOrder, "performedProcedureId" | "price" | "status" | "costKept">;

export const countsAsLabCost = (order: Pick<LabOrder, "status" | "costKept">): boolean =>
  order.status !== LAB_ORDER_STATUS.CANCELLED || order.costKept;

export function labCostOf(orders: readonly CostedOrder[], procedureId: string): Money {
  return orders
    .filter((order) => order.performedProcedureId === procedureId && countsAsLabCost(order))
    .reduce<Money>((total, order) => addMoney(total, order.price), "0.00");
}

export function labCostOfAll(
  orders: readonly CostedOrder[],
  procedureIds: readonly string[],
): Money {
  return procedureIds.reduce<Money>(
    (total, procedureId) => addMoney(total, labCostOf(orders, procedureId)),
    "0.00",
  );
}

export const afterLabCost = (price: Money, labCost: Money): Money => subtractMoney(price, labCost);

export const labOrdersOnTooth = <T extends Pick<LabOrder, "teeth">>(
  orders: readonly T[],
  tooth: number,
): T[] => orders.filter((order) => order.teeth.includes(tooth));
