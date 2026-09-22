import {
  AI_ERROR_CODE,
  AI_OUTBOUND_ERROR,
  AI_TOOL,
  CLINIC_SECRET_ERROR,
  type AiErrorCode,
  type AiOutboundError,
  type AiToolName,
} from "@clinic/shared";
import { ApiError, errorMessageKey as httpErrorKey } from "@web/lib/api-error";

// The API answers in codes and this side writes the words (CLAUDE.md). Exhaustive records rather
// than lookups with a fallback: adding a code to the enum fails the build here until it has copy.
const ERROR_KEYS: Record<AiErrorCode, string> = {
  [AI_ERROR_CODE.RATE_LIMITED]: "assistant.errors.rateLimited",
  [AI_ERROR_CODE.BUDGET_EXHAUSTED]: "assistant.errors.budgetExhausted",
  [AI_ERROR_CODE.PROVIDER_UNAVAILABLE]: "assistant.errors.providerUnavailable",
  [AI_ERROR_CODE.PROVIDER_REJECTED]: "assistant.errors.providerRejected",
  [AI_ERROR_CODE.PROVIDER_QUOTA]: "assistant.errors.providerQuota",
  [AI_ERROR_CODE.STEP_LIMIT]: "assistant.errors.stepLimit",
  [AI_ERROR_CODE.FAILED]: "assistant.errors.failed",
  [AI_ERROR_CODE.CONNECTION_LOST]: "assistant.errors.connectionLost",
  [AI_ERROR_CODE.OFFLINE]: "assistant.errors.offline",
};

/** Failures an admin fixes under the provider keys rather than by trying again. */
const KEY_FAILURES: ReadonlySet<AiErrorCode> = new Set([
  AI_ERROR_CODE.PROVIDER_REJECTED,
  AI_ERROR_CODE.PROVIDER_QUOTA,
]);

export const isKeyFailure = (code: AiErrorCode): boolean => KEY_FAILURES.has(code);

const TOOL_KEYS: Record<AiToolName, string> = {
  [AI_TOOL.GET_APPOINTMENTS]: "assistant.tools.appointments",
  [AI_TOOL.SEARCH_PATIENTS]: "assistant.tools.patients",
  [AI_TOOL.GET_PATIENT_SUMMARY]: "assistant.tools.patientSummary",
  [AI_TOOL.GET_DAILY_STATS]: "assistant.tools.dailyStats",
  [AI_TOOL.GET_FINANCIAL_SUMMARY]: "assistant.tools.financialSummary",
  [AI_TOOL.GET_OVERDUE_LAB_ORDERS]: "assistant.tools.labOrders",
  [AI_TOOL.GET_LOW_STOCK_ITEMS]: "assistant.tools.lowStock",
  [AI_TOOL.DRAFT_BULK_MESSAGE]: "assistant.tools.draftMessage",
};

const OUTBOUND_ERROR_KEYS: Record<AiOutboundError, string> = {
  [AI_OUTBOUND_ERROR.EXPIRED]: "assistant.outboundErrors.expired",
  [AI_OUTBOUND_ERROR.NOT_PENDING]: "assistant.outboundErrors.notPending",
  [AI_OUTBOUND_ERROR.RECIPIENT_CAP]: "assistant.outboundErrors.recipientCap",
  [AI_OUTBOUND_ERROR.DAILY_CAP]: "assistant.outboundErrors.dailyCap",
  [AI_OUTBOUND_ERROR.NO_RECIPIENTS]: "assistant.outboundErrors.noRecipients",
  [AI_OUTBOUND_ERROR.NOTIFICATIONS_DISABLED]: "assistant.outboundErrors.notificationsDisabled",
};

/** A refusal's code when the API sent one this build knows, else the status's general wording. */
export function outboundErrorKey(error: unknown): string {
  const message =
    error instanceof ApiError
      ? (error.payload as { message?: unknown } | undefined)?.message
      : undefined;

  if (typeof message === "string" && message in OUTBOUND_ERROR_KEYS) {
    return OUTBOUND_ERROR_KEYS[message as AiOutboundError];
  }

  if (message === CLINIC_SECRET_ERROR.UNAVAILABLE) {
    return "assistantSettings.keys.unavailable";
  }

  return httpErrorKey(error);
}

export const errorMessageKey = (code: AiErrorCode): string => ERROR_KEYS[code];

export const toolStatusKey = (tool: AiToolName): string => TOOL_KEYS[tool];

/** Whether the code the API sent is one this build knows — an older page against a newer API. */
export const isAiErrorCode = (value: unknown): value is AiErrorCode =>
  typeof value === "string" && value in ERROR_KEYS;
