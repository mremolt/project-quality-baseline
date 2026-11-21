/** Why a call failed for technical reasons; the UI shows one generic message for all of them. */
export type TechnicalFailure = 'network' | 'timeout' | 'server' | 'malformed-response' | 'unexpected';

/** A failure the user cannot fix by changing input: server error, network failure, time-out, unknown code (TS-ARCH-18). */
export class TechnicalError extends Error {
  override readonly name = 'TechnicalError';
  readonly failure: TechnicalFailure;

  constructor(message: string, options?: ErrorOptions & { readonly failure?: TechnicalFailure }) {
    super(message, options);
    this.failure = options?.failure ?? 'unexpected';
  }
}

/** The caller has no valid session; the UI sends the user to the login. */
export class UnauthenticatedError extends Error {
  override readonly name = 'UnauthenticatedError';
}
