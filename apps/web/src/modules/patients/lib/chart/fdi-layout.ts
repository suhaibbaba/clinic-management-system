import { FDI_ARCHES } from "@clinic/shared";
import { toothTypeOf, type ToothType } from "@web/modules/patients/lib/chart/tooth-shapes";

export type Dentition = "permanent" | "deciduous";
export type Arch = "upper" | "lower";

export interface ToothSlot {
  readonly tooth: number;
  readonly arch: Arch;
  readonly index: number;
  readonly type: ToothType;
}

export function archRow(dentition: Dentition, arch: Arch): readonly number[] {
  return FDI_ARCHES[(dentition === "deciduous" ? 2 : 0) + (arch === "lower" ? 1 : 0)] ?? [];
}

export function layoutRow(dentition: Dentition, arch: Arch): ToothSlot[] {
  return archRow(dentition, arch).map((tooth, index) => ({
    tooth,
    arch,
    index,
    type: toothTypeOf(tooth, arch),
  }));
}

export function layoutTeeth(dentition: Dentition): ToothSlot[] {
  return [...layoutRow(dentition, "upper"), ...layoutRow(dentition, "lower")];
}

export function navigationOrder(dentition: Dentition): number[] {
  return layoutTeeth(dentition).map((slot) => slot.tooth);
}
