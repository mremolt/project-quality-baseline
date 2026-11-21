/** Why a backend call failed for technical reasons; the UI shows one generic message for all of them. */
export type TechnicalFailure = 'network' | 'timeout' | 'server' | 'unauthorized' | 'malformed-response' | 'unexpected';

/**
 * A failure the user cannot fix by changing input (TS-ARCH-18). Whoever creates one reports it once: the HTTP mutator
 * (network, timeout, server, a body that is not JSON), the feature adapter (malformed-response, unexpected).
 * `unauthorized` is not reported: it leads to the login.
 */
export class TechnicalError extends Error {
  override readonly name = 'TechnicalError';

  constructor(
    readonly failure: TechnicalFailure,
    options?: ErrorOptions,
  ) {
    super(`Technical failure: ${failure}`, options);
  }
}
