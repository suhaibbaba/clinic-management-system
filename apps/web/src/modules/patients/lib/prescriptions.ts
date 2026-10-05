import { regimenShorthand, type PrescriptionItem } from "@clinic/shared";

const LEFT_TO_RIGHT_ISOLATE = "⁦";
const POP_DIRECTIONAL_ISOLATE = "⁩";

export function describeItem(item: PrescriptionItem): string {
  const shorthand = regimenShorthand(item);

  return [
    shorthand && `${LEFT_TO_RIGHT_ISOLATE}${shorthand}${POP_DIRECTIONAL_ISOLATE}`,
    item.dose,
    item.frequency,
    item.duration,
  ]
    .filter(Boolean)
    .join(" · ");
}
