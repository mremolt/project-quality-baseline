import { setupServer } from 'msw/node';

import { ordersStubHandlers } from '@/features/orders/adapter/out/http/orders-stub-handlers';
import { idpStubHandlers } from '@/platform/adapter/out/oidc/idp-stub-handlers';

/** Test mode only (APP_TEST_STUBS=1): every server-side call to the backend and the IdP is answered by stubs. */
export function startBackendStubs(): void {
  setupServer(...idpStubHandlers, ...ordersStubHandlers).listen({ onUnhandledFrame: 'bypass' });
}
