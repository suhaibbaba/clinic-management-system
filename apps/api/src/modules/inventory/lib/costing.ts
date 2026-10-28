import { roundDiv } from "@clinic/shared";

export interface CostLayers {
  readonly onHand: number;
  readonly unknown: number;
  readonly knownValue: number;
}

export interface CostedQuantity {
  readonly value: number;
  readonly unknown: number;
}

const knownQuantity = (layers: CostLayers): number => layers.onHand - layers.unknown;

export function costOut(layers: CostLayers, taking: number): CostedQuantity {
  const fromUnknown = Math.min(taking, Math.max(layers.unknown, 0));
  const fromKnown = taking - fromUnknown;
  const known = knownQuantity(layers);

  if (fromKnown === 0 || known <= 0) {
    return { value: 0, unknown: 0 - fromUnknown };
  }

  const value =
    fromKnown >= known ? layers.knownValue : roundDiv(fromKnown * layers.knownValue, known);

  return { value: -value, unknown: 0 - fromUnknown };
}

export function costIn(layers: CostLayers, adding: number): CostedQuantity {
  const known = knownQuantity(layers);

  return known > 0
    ? { value: roundDiv(adding * layers.knownValue, known), unknown: 0 }
    : { value: 0, unknown: adding };
}

export function averageCost(layers: CostLayers): number | null {
  const known = knownQuantity(layers);

  return known > 0 ? roundDiv(layers.knownValue * 100 * 1000, known) : null;
}
