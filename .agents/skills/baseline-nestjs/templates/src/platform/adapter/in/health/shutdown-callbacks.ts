import { Injectable, type OnApplicationShutdown } from '@nestjs/common';

/** Callbacks that run after the HTTP server closed, in registration order (telemetry flush; NEST-OBS-04). */
@Injectable()
export class ShutdownCallbacks implements OnApplicationShutdown {
  private readonly callbacks: (() => Promise<unknown>)[] = [];

  add(callback: () => Promise<unknown>): void {
    this.callbacks.push(callback);
  }

  async onApplicationShutdown(): Promise<void> {
    for (const callback of this.callbacks) await callback();
  }
}
