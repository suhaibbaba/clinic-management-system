import { AI_ERROR_CODE, AI_TOOL, type AiErrorCode, type AiToolName } from "@clinic/shared";

// The API answers in codes and this side writes the words (CLAUDE.md). Exhaustive records rather
// than lookups with a fallback: adding a code to the enum fails the build here until it has copy.
const ERROR_KEYS: Record<AiErrorCode, string> = {
  [AI_ERROR_CODE.RATE_LIMITED]: "assistant.errors.rateLimited",
  [AI_ERROR_CODE.BUDGET_EXHAUSTED]: "assistant.errors.budgetExhausted",
  [AI_ERROR_CODE.PROVIDER_UNAVAILABLE]: "assistant.errors.providerUnavailable",
  [AI_ERROR_CODE.STEP_LIMIT]: "assistant.errors.stepLimit",
  [AI_ERROR_CODE.FAILED]: "assistant.errors.failed",
};

const TOOL_KEYS: Record<AiToolName, string> = {
  [AI_TOOL.GET_APPOINTMENTS]: "assistant.tools.appointments",
  [AI_TOOL.SEARCH_PATIENTS]: "assistant.tools.patients",
  [AI_TOOL.GET_PATIENT_SUMMARY]: "assistant.tools.patientSummary",
  [AI_TOOL.GET_DAILY_STATS]: "assistant.tools.dailyStats",
  [AI_TOOL.GET_FINANCIAL_SUMMARY]: "assistant.tools.financialSummary",
  [AI_TOOL.GET_OVERDUE_LAB_ORDERS]: "assistant.tools.labOrders",
  [AI_TOOL.GET_LOW_STOCK_ITEMS]: "assistant.tools.lowStock",
};

export const errorMessageKey = (code: AiErrorCode): string => ERROR_KEYS[code];

export const toolStatusKey = (tool: AiToolName): string => TOOL_KEYS[tool];

/** Whether the code the API sent is one this build knows — an older page against a newer API. */
export const isAiErrorCode = (value: unknown): value is AiErrorCode =>
  typeof value === "string" && value in ERROR_KEYS;
