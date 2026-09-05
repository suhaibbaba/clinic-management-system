/**
 * An error the API answered with. Carries the HTTP status only — Arabic copy is
 * resolved from that code on this side, never from the backend's English
 * message (CLAUDE.md: "Arabic-facing messages resolved on the frontend by error
 * code, not by backend strings").
 */
export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    readonly payload?: unknown,
  ) {
    super(`API request failed with status ${statusCode}`);
    this.name = 'ApiError';
  }
}

/** Raised when the request never reached the API. */
export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super('Could not reach the API');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/** Maps a failure onto an i18n key. Status codes in, translation keys out. */
export function errorMessageKey(error: unknown): string {
  if (error instanceof NetworkError) {
    return 'errors.network';
  }

  if (error instanceof ApiError) {
    switch (error.statusCode) {
      case 400:
      case 422:
        return 'errors.badRequest';
      case 401:
        return 'errors.unauthorized';
      case 403:
        return 'errors.forbidden';
      case 404:
        return 'errors.notFound';
      case 409:
        return 'errors.conflict';
      default:
        return error.statusCode >= 500 ? 'errors.server' : 'errors.unknown';
    }
  }

  return 'errors.unknown';
}
