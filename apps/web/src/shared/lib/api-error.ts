import {
  APPOINTMENT_ERROR,
  PAYROLL_ERROR,
  APPOINTMENT_TIMING_ERROR,
  AUTH_ERROR,
  CLINICAL_DELETE_ERROR,
  DOCUMENT_SEND_ERROR,
  LAB_ORDER_ERROR,
  PAYMENT_ERROR,
  STOCK_ERROR,
} from "@clinic/shared";
import i18n from "@web/i18n";
import { FIELD_LABELS } from "@web/shared/constants/field-labels";
import { formatList } from "@web/shared/lib/format";

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly payload?: unknown,
  ) {
    super(`API request failed with status ${statusCode}`);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super("Could not reach the API");
    this.name = "NetworkError";
    this.cause = cause;
  }
}

const CODED_MESSAGES: Readonly<Record<string, string>> = {
  [APPOINTMENT_TIMING_ERROR.DAY_NOT_REACHED]: "errors.appointment.dayNotReached",
  [APPOINTMENT_TIMING_ERROR.NOT_STARTED]: "errors.appointment.notStarted",
  [APPOINTMENT_TIMING_ERROR.DAY_PASSED]: "errors.appointment.dayPassed",
  [APPOINTMENT_ERROR.SLOT_TAKEN]: "errors.appointment.slotTaken",
  [APPOINTMENT_ERROR.CLOSED]: "errors.appointment.closed",
  [APPOINTMENT_ERROR.BAD_TRANSITION]: "errors.appointment.badTransition",
  [APPOINTMENT_ERROR.CANCEL_NEEDS_REASON]: "errors.appointment.cancelNeedsReason",
  [APPOINTMENT_ERROR.HAS_VISIT]: "errors.appointment.hasVisit",
  [APPOINTMENT_ERROR.NOT_ARRIVED]: "errors.appointment.notArrived",
  [PAYROLL_ERROR.MONTH_CLOSED]: "errors.payroll.monthClosed",
  [PAYROLL_ERROR.ALREADY_CLOSED]: "errors.payroll.alreadyClosed",
  [PAYROLL_ERROR.NOT_EMPLOYEE]: "errors.payroll.notEmployee",
  [PAYROLL_ERROR.FUTURE_MONTH]: "errors.payroll.futureMonth",
  [AUTH_ERROR.LOCKED]: "errors.auth.locked",
  [AUTH_ERROR.CODE_INVALID]: "errors.auth.codeInvalid",
  [AUTH_ERROR.GOOGLE_FAILED]: "errors.auth.googleFailed",
  [AUTH_ERROR.GOOGLE_NO_ACCOUNT]: "errors.auth.googleNoAccount",
  [AUTH_ERROR.PASSKEY_INVALID]: "errors.auth.passkeyInvalid",
  [CLINICAL_DELETE_ERROR.HAS_PAYMENTS]: "errors.clinicalDelete.hasPayments",
  [LAB_ORDER_ERROR.EXPECTED_IN_PAST]: "errors.labOrder.expectedInPast",
  [STOCK_ERROR.INSUFFICIENT]: "errors.stock.insufficient",
  [STOCK_ERROR.BELOW_ONE]: "errors.stock.belowOne",
  [PAYMENT_ERROR.EXCEEDS_BALANCE]: "errors.payment.exceedsBalance",
  [PAYMENT_ERROR.REVERSED]: "errors.payment.reversed",
  [DOCUMENT_SEND_ERROR.UNAVAILABLE]: "errors.document.unavailable",
  [DOCUMENT_SEND_ERROR.FAILED]: "errors.document.failed",
};

export function codedMessageKey(code: string | null | undefined): string | undefined {
  return code && Object.hasOwn(CODED_MESSAGES, code) ? CODED_MESSAGES[code] : undefined;
}

export function errorMessageKey(error: unknown): string {
  if (error instanceof NetworkError) {
    return "errors.network";
  }

  if (error instanceof ApiError) {
    const code = (error.payload as { message?: unknown } | undefined)?.message;

    if (typeof code === "string" && code in CODED_MESSAGES) {
      return CODED_MESSAGES[code] ?? "errors.unknown";
    }

    switch (error.statusCode) {
      case 400:
      case 422:
        return "errors.badRequest";
      case 401:
        return "errors.unauthorized";
      case 403:
        return "errors.forbidden";
      case 404:
        return "errors.notFound";
      case 409:
        return "errors.conflict";
      case 429:
        return "errors.tooMany";
      default:
        return error.statusCode >= 500 ? "errors.server" : "errors.unknown";
    }
  }

  return "errors.unknown";
}

export function invalidFieldLabels(error: unknown): string[] {
  if (!(error instanceof ApiError) || error.statusCode !== 400) {
    return [];
  }

  const issues = (error.payload as { errors?: unknown } | undefined)?.errors;

  if (!Array.isArray(issues)) {
    return [];
  }

  const labels = issues.flatMap((issue: { path?: unknown }) => {
    const path = Array.isArray(issue.path) ? [...issue.path].reverse() : [];
    const field = path.find(
      (segment): segment is string => typeof segment === "string" && segment in FIELD_LABELS,
    );

    return field === undefined ? [] : [FIELD_LABELS[field] as string];
  });

  return [...new Set(labels)];
}

export function errorToast(error: unknown): [string, Record<string, string>?] {
  const fields = invalidFieldLabels(error);

  if (fields.length > 0) {
    return ["errors.invalidFields", { fields: formatList(fields.map((key) => i18n.t(key))) }];
  }

  return [errorMessageKey(error)];
}
