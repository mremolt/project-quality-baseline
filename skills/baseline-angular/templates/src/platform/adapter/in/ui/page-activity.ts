import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/**
 * RES-POL-01: what the browser says about the page, as signals: is the tab visible, is the browser online. Pollers
 * pause while the tab is hidden and poll at once when it becomes visible or the connection returns.
 * Root-provided UI adapter; a feature that needs it injects it (NG-ARCH-04), nothing else reads `document` for this.
 */
@Injectable({ providedIn: 'root' })
export class PageActivity {
  private readonly visibleState = signal(typeof document === 'undefined' || document.visibilityState === 'visible');
  private readonly onlineState = signal(typeof navigator === 'undefined' || navigator.onLine);
  readonly visible = this.visibleState.asReadonly();
  readonly online = this.onlineState.asReadonly();

  constructor() {
    if (typeof document === 'undefined') {
      return;
    }
    const onVisibility = () => this.visibleState.set(document.visibilityState === 'visible');
    const onOnline = () => this.onlineState.set(true);
    const onOffline = () => this.onlineState.set(false);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    });
  }
}
