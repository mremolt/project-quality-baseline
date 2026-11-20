import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { Caller } from '../../../domain/index.js';

export const IS_PUBLIC = 'auth:public';
export const ROLES = 'auth:roles';

/** Opens an endpoint without a token; state the reason in the pull request (NEST-SEC-01). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC, true);

/** Coarse role check only; object-level authorization belongs to the use case (NEST-SEC-02). */
export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES, roles);

export type CallerRequest = FastifyRequest & { caller?: Caller };

export const CurrentCaller = createParamDecorator((_: unknown, ctx: ExecutionContext): Caller => {
  const caller = ctx.switchToHttp().getRequest<CallerRequest>().caller;
  if (!caller) throw new Error('CurrentCaller on a public endpoint');
  return caller;
});
