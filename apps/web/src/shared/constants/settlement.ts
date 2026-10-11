import type { SettlementLineStatus } from "@clinic/shared";
import type { BadgeTone } from "@clinic/ui";

export const SETTLEMENT_STATUS_TONES: Record<SettlementLineStatus, BadgeTone> = {
  unpaid: "warning",
  paid: "success",
  adjusted: "info",
};
