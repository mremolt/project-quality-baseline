// Public API of the platform usable on server and client. Client UI: ./index.client.ts; server-only: ./index.server.ts
export { HttpProblem } from './adapter/out/http/http-problem';
export type { PublicConfig } from './config/public-config';
export type { Caller } from './domain';
export { TechnicalError, UnauthenticatedError } from './domain';
