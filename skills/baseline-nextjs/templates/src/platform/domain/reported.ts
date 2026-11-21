/**
 * Marks an error as reported, so that the next place that sees it does not report it again (TS-ARCH-18, NEXT-OBS-09).
 * A global symbol as a non-enumerable property, not a module-level `WeakSet`: Next.js bundles `instrumentation.ts`
 * and the app's server code separately, and both must see the same mark.
 */
const REPORTED = Symbol.for('platform.error-reported');

export function markReported(error: unknown): void {
  if (typeof error !== 'object' || error === null || wasReported(error)) return;
  Object.defineProperty(error, REPORTED, { value: true, enumerable: false });
}

/** True when the error or one of its causes was reported (a mapper wraps what the mutator reported as `cause`). */
export function wasReported(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;
  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    if (Object.hasOwn(current, REPORTED)) return true;
    seen.add(current);
    current = (current as { readonly cause?: unknown }).cause;
  }
  return false;
}
