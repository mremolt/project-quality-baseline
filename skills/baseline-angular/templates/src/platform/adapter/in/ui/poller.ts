import { DestroyRef, effect, inject, untracked } from '@angular/core';

import { PageActivity } from './page-activity';

export interface PollerOptions {
  /** Interval between polls while the page is active, in milliseconds. */
  readonly intervalMs: number;
  /** Upper bound of the backoff after failures, in milliseconds. */
  readonly maxBackoffMs: number;
  /** One poll. Resolves when done; rejects on failure (counts toward the backoff). Never shows an error itself. */
  readonly poll: () => Promise<void>;
}

/**
 * RES-POL-01: a poll loop owned by a component or route-level store (call it in an injection context). No overlap
 * (the next timer starts after the poll settled), pauses while the tab is hidden or the browser is offline, polls at
 * once when the page becomes active again, backs off exponentially after failures, and leaves no timer behind when
 * its owner is destroyed. Background failures are swallowed here; the owner shows a connection state, not a snackbar
 * per failed poll.
 */
export function startPoller(options: PollerOptions): void {
  const activity = inject(PageActivity);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let failures = 0;
  let stopped = false;

  const schedule = (delay: number) => {
    clearTimeout(timer);
    if (!stopped) {
      timer = setTimeout(() => void tick(), delay);
    }
  };
  const tick = async () => {
    if (running || stopped) {
      return;
    }
    running = true;
    try {
      await options.poll();
      failures = 0;
    } catch {
      failures += 1;
    } finally {
      running = false;
    }
    const backoff = Math.min(options.maxBackoffMs, options.intervalMs * 2 ** failures);
    schedule(failures === 0 ? options.intervalMs : backoff);
  };

  const ref = effect((onCleanup) => {
    const active = activity.visible() && activity.online();
    untracked(() => {
      if (active) {
        void tick(); // immediately on focus / online, then on the interval
      } else {
        clearTimeout(timer);
      }
    });
    onCleanup(() => clearTimeout(timer));
  });
  inject(DestroyRef).onDestroy(() => {
    stopped = true;
    clearTimeout(timer);
    ref.destroy();
  });
}
