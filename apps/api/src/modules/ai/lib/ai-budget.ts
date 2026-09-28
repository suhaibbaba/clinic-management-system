import { type AiErrorCode } from "@clinic/shared";

export class AiLimitError extends Error {
  constructor(readonly code: AiErrorCode) {
    super(code);
    this.name = "AiLimitError";
  }
}
