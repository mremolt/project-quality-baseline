import { DestroyRef, inject, Injectable, signal } from '@angular/core';

import { CLOCK } from '../../../platform.tokens'; // CLOCK: the platform clock (NG-ARCH-24, TS-ARCH-22)

const CHANNEL = 'session-activity';

/**
 * NG-SEC-13: when the backend last answered (and so last renewed the idle timer of the session), as epoch milliseconds.
 * The time is shared between the app's tabs (A11Y-29): a tab the user is not working in must not warn and log out
 * while another tab keeps the session alive. Before the shell redirects to login, it asks the server for the
 * remaining idle time instead of trusting this value alone.
 */
@Injectable({ providedIn: 'root' })
export class SessionActivity {
  private readonly clock = inject(CLOCK);
  private readonly state = signal(this.clock.now());
  private readonly channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(CHANNEL);
  readonly lastAnswerAt = this.state.asReadonly();

  constructor() {
    if (this.channel) {
      this.channel.onmessage = (event: MessageEvent<unknown>) => {
        if (typeof event.data === 'number' && event.data > this.state()) {
          this.state.set(event.data);
        }
      };
      inject(DestroyRef).onDestroy(() => this.channel?.close());
    }
  }

  touch(): void {
    const now = this.clock.now();
    this.state.set(now);
    this.channel?.postMessage(now);
  }
}
