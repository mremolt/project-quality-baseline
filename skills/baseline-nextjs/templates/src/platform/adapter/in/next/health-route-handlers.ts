import type { RouteHandler } from './auth-route-handlers';

export interface Readiness {
  /** False once shutdown started (OBS-04) or while a dependency the instance cannot serve without is down. */
  isReady(): Promise<boolean>;
}

const noStore = { 'cache-control': 'no-store' };

export const livenessHandler: RouteHandler = () =>
  Promise.resolve(Response.json({ status: 'UP' }, { headers: noStore }));

export function createReadinessHandler(readiness: Readiness): RouteHandler {
  return async () => {
    const ready = await readiness.isReady().catch(() => false);
    return Response.json({ status: ready ? 'UP' : 'DOWN' }, { status: ready ? 200 : 503, headers: noStore });
  };
}
