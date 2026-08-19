export type RuleErrorCode =
  | "INVALID_STATE"
  | "INVALID_TRANSITION"
  | "UNKNOWN_ID"
  | "DUPLICATE_ID"
  | "INVALID_GENERATION"
  | "INSUFFICIENT_GOLD"
  | "INVALID_SETTLEMENT";

export type RuleErrorDetails = Record<string, unknown>;

export class RuleError extends Error {
  readonly code: RuleErrorCode;
  readonly details: RuleErrorDetails;

  constructor(
    code: RuleErrorCode,
    message: string,
    details: RuleErrorDetails = {},
  ) {
    super(message);
    this.name = "RuleError";
    this.code = code;
    this.details = details;
  }
}
