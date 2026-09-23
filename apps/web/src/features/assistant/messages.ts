import {
  AI_ACTION_ERROR,
  AI_ERROR_CODE,
  AI_OUTBOUND_ERROR,
  AI_TOOL,
  CLINIC_SECRET_ERROR,
  type AiActionError,
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
  [AI_TOOL.SET_APPOINTMENT_STATUS]: "assistant.tools.appointmentStatus",
  [AI_TOOL.ADD_PATIENT_NOTE]: "assistant.tools.patientNote",
  [AI_TOOL.CREATE_APPOINTMENT]: "assistant.tools.createAppointment",
  [AI_TOOL.RESCHEDULE_APPOINTMENT]: "assistant.tools.rescheduleAppointment",
  [AI_TOOL.CANCEL_APPOINTMENTS]: "assistant.tools.cancelAppointments",
  [AI_TOOL.CREATE_PATIENT]: "assistant.tools.createPatient",
  [AI_TOOL.RECORD_PAYMENT]: "assistant.tools.recordPayment",
  [AI_TOOL.FIND_DOCTORS]: "assistant.tools.findDoctors",
  [AI_TOOL.ADD_DOCTOR_TIME_OFF]: "assistant.tools.doctorTimeOff",
  [AI_TOOL.ADD_CLINIC_CLOSURE]: "assistant.tools.clinicClosure",
  [AI_TOOL.UPDATE_DOCTOR_TIME_OFF]: "assistant.tools.updateTimeOff",
  [AI_TOOL.DELETE_DOCTOR_TIME_OFF]: "assistant.tools.deleteTimeOff",
  [AI_TOOL.SET_LAB_ORDER_STATUS]: "assistant.tools.labOrderStatus",
  [AI_TOOL.RECORD_STOCK_MOVEMENT]: "assistant.tools.stockMovement",
  [AI_TOOL.SET_DOCTOR_SCHEDULE]: "assistant.tools.doctorSchedule",
  [AI_TOOL.REVERSE_PAYMENT]: "assistant.tools.reversePayment",
  [AI_TOOL.RECORD_LAB_PAYMENT]: "assistant.tools.labPayment",
  [AI_TOOL.REVERSE_LAB_PAYMENT]: "assistant.tools.reverseLabPayment",
  [AI_TOOL.REVERSE_STOCK_MOVEMENT]: "assistant.tools.reverseStockMovement",
  [AI_TOOL.FIND_AVAILABLE_SLOTS]: "assistant.tools.findSlots",
  [AI_TOOL.ADD_DOCTOR_EXTRA_HOURS]: "assistant.tools.extraHours",
  [AI_TOOL.PROPOSE_PLAN]: "assistant.tools.plan",
  [AI_TOOL.QUERY_DATA]: "assistant.tools.queryData",
  [AI_TOOL.LOAD_TOOLS]: "assistant.tools.loadTools",
};

const ACTION_ERROR_KEYS: Record<AiActionError, string> = {
  [AI_ACTION_ERROR.PHRASE_MISMATCH]: "assistant.actionErrors.phraseMismatch",
  [AI_ACTION_ERROR.NOT_PERMITTED]: "assistant.actionErrors.notPermitted",
  [AI_ACTION_ERROR.DISABLED]: "assistant.actionErrors.disabled",
  [AI_ACTION_ERROR.SLOT_TAKEN]: "assistant.actionErrors.slotTaken",
  [AI_ACTION_ERROR.INVALID_TRANSITION]: "assistant.actionErrors.invalidTransition",
  [AI_ACTION_ERROR.NOT_FOUND]: "assistant.actionErrors.notFound",
  [AI_ACTION_ERROR.DUPLICATE]: "assistant.actionErrors.duplicate",
  [AI_ACTION_ERROR.SCHEDULE_CONFLICT]: "assistant.actionErrors.scheduleConflict",
  [AI_ACTION_ERROR.CHANGED_SINCE_DRAFT]: "assistant.actionErrors.changedSinceDraft",
  [AI_ACTION_ERROR.INPUT_REQUIRED]: "assistant.actionErrors.inputRequired",
  [AI_ACTION_ERROR.FAILED]: "assistant.actionErrors.failed",
};

/** Why an action failed once it ran, as the proposal records it. */
export const actionErrorKey = (code: AiActionError): string => ACTION_ERROR_KEYS[code];

/** A refusal at the card's button: an action's own code, a proposal's, or the status's wording. */
export function actionRefusalKey(error: unknown): string {
  const message =
    error instanceof ApiError
      ? (error.payload as { message?: unknown } | undefined)?.message
      : undefined;

  if (typeof message === "string" && message in ACTION_ERROR_KEYS) {
    return ACTION_ERROR_KEYS[message as AiActionError];
  }

  return outboundErrorKey(error);
}

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
