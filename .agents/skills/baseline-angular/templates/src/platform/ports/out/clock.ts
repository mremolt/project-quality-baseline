/**
 * The platform clock (TS-ARCH-22, NG-ARCH-24): the only source of the current time in the app. `platform.tokens.ts`
 * provides it as `CLOCK = new InjectionToken<Clock>('Clock', { providedIn: 'root', factory: () => ({ now: () => Date.now() }) })`;
 * tests provide a fixed clock instead.
 */
export interface Clock {
  /** The current instant as epoch milliseconds. */
  now(): number;
}
