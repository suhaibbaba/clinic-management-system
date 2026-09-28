import { type MovementType, MOVEMENT_TYPE } from "@clinic/shared";
import type { BadgeTone } from "@clinic/ui/components/badge";

export const movementLabel = (type: MovementType): string => `inventory.movements.${type}`;

export const MOVEMENT_TONES: Record<MovementType, BadgeTone> = {
  [MOVEMENT_TYPE.PURCHASE]: "success",
  [MOVEMENT_TYPE.CONSUME]: "info",
  [MOVEMENT_TYPE.ADJUST]: "warning",
};
