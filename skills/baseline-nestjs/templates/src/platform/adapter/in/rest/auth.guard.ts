import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

import { AUTH_CONFIG, AuthConfig } from '../../../config/platform.config.js';
import type { Caller } from '../../../domain/index.js';
import { type CallerRequest, IS_PUBLIC, ROLES } from './auth.decorators.js';

export const JWKS = Symbol('Jwks');

/** One global guard: deny by default, verify bearer JWTs with pinned checks, build the Caller (NEST-SEC-01..04). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(JWKS) private readonly keys: JWTVerifyGetKey,
    @Inject(AUTH_CONFIG) private readonly cfg: AuthConfig,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, targets)) return true;
    const request = ctx.switchToHttp().getRequest<CallerRequest>();
    request.caller = await this.authenticate(request.headers.authorization);
    const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES, targets) ?? [];
    if (roles.length > 0 && !roles.some((r) => request.caller?.roles.includes(r))) throw new ForbiddenException();
    return true;
  }

  private async authenticate(header: string | undefined): Promise<Caller> {
    const token = /^Bearer ([\w.~+/-]+=*)$/.exec(header ?? '')?.[1];
    if (!token) throw new UnauthorizedException();
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        issuer: this.cfg.AUTH_ISSUER,
        audience: this.cfg.AUTH_AUDIENCE,
        algorithms: ['RS256'],
        clockTolerance: this.cfg.AUTH_CLOCK_TOLERANCE_SECONDS,
        requiredClaims: ['sub', 'exp'],
      });
      const roles = Array.isArray(payload['roles']) ? payload['roles'].filter((r) => typeof r === 'string') : [];
      return { id: payload.sub ?? '', roles };
    } catch (err) {
      if (err instanceof errors.JOSEError) throw new UnauthorizedException();
      throw err; // fail closed
    }
  }
}
