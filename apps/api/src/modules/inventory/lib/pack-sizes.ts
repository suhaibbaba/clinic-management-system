import { formatMinorUnits, roundDiv, toMinorUnits, toThousandths } from "@clinic/shared";

export interface ResolvedPack {
  readonly unit: string;
  readonly unitsPer: string;
}

export function baseUnits(packs: number, pack: ResolvedPack | undefined): number {
  return pack ? roundDiv(packs * toThousandths(pack.unitsPer), 1000) : packs;
}

export function basePrice(price: string, pack: ResolvedPack | undefined): string {
  return pack
    ? formatMinorUnits(roundDiv(toMinorUnits(price) * 1000, toThousandths(pack.unitsPer)))
    : price;
}
