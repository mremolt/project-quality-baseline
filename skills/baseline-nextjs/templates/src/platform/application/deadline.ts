/**
 * Settles like `promise`, or rejects with the deadline's reason once it fires (NEXT-RES-03). The work behind `promise`
 * is not cancelled: a shared token refresh, for example, finishes and stores its result for the next caller.
 */
export function untilDeadline<T>(promise: Promise<T>, deadline: AbortSignal | undefined): Promise<T> {
  if (!deadline) return promise;
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(deadline.reason as Error);
    };
    if (deadline.aborted) {
      onAbort();
      return;
    }
    deadline.addEventListener('abort', onAbort, { once: true });
    void promise.then(resolve, reject).finally(() => {
      deadline.removeEventListener('abort', onAbort);
    });
  });
}
