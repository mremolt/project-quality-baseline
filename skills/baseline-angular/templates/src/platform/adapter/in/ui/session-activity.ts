import { Injectable, signal } from '@angular/core';

/** NG-SEC-13: when the backend last answered (and so last renewed the idle timer of the session), as epoch milliseconds. */
@Injectable({ providedIn: 'root' })
export class SessionActivity {
  private readonly state = signal(Date.now());
  readonly lastAnswerAt = this.state.asReadonly();

  touch(): void {
    this.state.set(Date.now());
  }
}
