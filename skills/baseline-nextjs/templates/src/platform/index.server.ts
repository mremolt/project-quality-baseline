import 'server-only';

// Public API of the platform for server code: route handlers, server components, server actions.
export {
  API_CONTENT_SECURITY_POLICY,
  createNonce,
  isCrossOriginAction,
  pageContentSecurityPolicy,
  SECURITY_HEADERS,
} from './adapter/in/next/security-headers';
export { logger } from './adapter/out/logging/logger';
export { serverConfig } from './config/server-config';
export type { Caller } from './domain';
export { TechnicalError, UnauthenticatedError } from './domain';
export {
  apiProxy,
  authRouteHandlers,
  currentCaller,
  healthRouteHandlers,
  publicRuntimeConfig,
} from './platform.composition.server';
