/** Error categories of ARCH-UC-13 (NODE-ARCH-07). Adapters classify by these base classes, never by concrete class. */
export abstract class DomainError extends Error {
  protected constructor(
    readonly code: string,
    message: string,
    /** Values for a localized message (I18N); never personal data that must not be logged. */
    readonly params: Readonly<Record<string, string | number>> = {},
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Invalid input: 400 in REST, not retryable in messaging. */
export class DomainValidationError extends DomainError {
  constructor(
    code: string,
    readonly field?: string,
  ) {
    super(code, field ? `Validation failed: ${code} (${field})` : `Validation failed: ${code}`);
  }
}

/** The current state forbids the operation: 409 with the rule's code. */
export abstract class BusinessRuleError extends DomainError {}

/** The addressed object does not exist, or the caller may not know it: 404. */
export abstract class NotFoundError extends DomainError {}

/** Concurrent change (version mismatch, duplicate key): 409, retried with backoff in messaging. */
export abstract class ConflictError extends DomainError {}

/** Optimistic-lock failure; the transaction adapter re-runs the unit of work (NEST-DB). */
export abstract class ConcurrentModificationError extends ConflictError {}

/** Technical, temporary: a dependency is unavailable (pool wait, open circuit, full bulkhead). 503 + Retry-After. */
export class UnavailableError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'UnavailableError';
  }
}
