import {
  AUTH_ERROR,
  CLINICAL_DELETE_ERROR,
  LAB_ORDER_ERROR,
  PAYMENT_ERROR,
  STOCK_ERROR,
} from "@clinic/shared";

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
  [AUTH_ERROR.LOCKED]: "errors.auth.locked",
  [CLINICAL_DELETE_ERROR.HAS_PAYMENTS]: "errors.clinicalDelete.hasPayments",
  [LAB_ORDER_ERROR.EXPECTED_IN_PAST]: "errors.labOrder.expectedInPast",
  [STOCK_ERROR.INSUFFICIENT]: "errors.stock.insufficient",
  [STOCK_ERROR.BELOW_ONE]: "errors.stock.belowOne",
  [PAYMENT_ERROR.EXCEEDS_BALANCE]: "errors.payment.exceedsBalance",
  [PAYMENT_ERROR.REVERSED]: "errors.payment.reversed",
};

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
