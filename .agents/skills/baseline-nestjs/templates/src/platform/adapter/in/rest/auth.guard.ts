import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { errors, jwtVerify, type JWTVerifyGetKey } from 'jose';

import { AUTH_CONFIG, AuthConfig } from '../../../config/platform.config.js';
import { type Caller, UnavailableError } from '../../../domain/index.js';
import { type CallerRequest, IS_PUBLIC, ROLES } from './auth.decorators.js';

export const JWKS = Symbol('Jwks');

/** A token was presented and rejected: 401 with the RFC 6750 challenge `Bearer error="invalid_token"`. */
export class InvalidTokenException extends UnauthorizedException {}

/** The key set could not be fetched; the identity provider is down, not the token wrong (NEST-SEC-04). */
class KeySetUnavailable extends Error {}

/**
 * Key set failures: timeout, network error (a non-jose error such as fetch's TypeError), an invalid set, and the
 * generic JOSEError jose throws for a non-200 or non-JSON answer. A missing or ambiguous kid is the token's fault.
 */
const isKeySetFailure = (err: unknown): boolean =>
  !(err instanceof errors.JOSEError) ||
  err instanceof errors.JWKSTimeout ||
  err instanceof errors.JWKSInvalid ||
  err.code === errors.JOSEError.code;

/** Audit reason of a key set failure: the jose code, or the error name of a network failure (TypeError). */
function reasonOf(cause: unknown): string {
  if (cause instanceof errors.JOSEError) return cause.code;
  return cause instanceof Error ? cause.name : 'unknown';
}

/** One global guard: deny by default, verify bearer JWTs with pinned checks, build the Caller (NEST-SEC-01..04). */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly log = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(JWKS) private readonly keys: JWTVerifyGetKey,
    @Inject(AUTH_CONFIG) private readonly cfg: AuthConfig,
  ) {}

  /** Key lookup that tells a key set outage (503) apart from a token the key set cannot verify (401). */
  private readonly key: JWTVerifyGetKey = async (header, input) => {
    try {
      return await this.keys(header, input);
    } catch (err) {
      throw isKeySetFailure(err) ? new KeySetUnavailable('key set unavailable', { cause: err }) : err;
    }
  };

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC, targets)) return true;
    const request = ctx.switchToHttp().getRequest<CallerRequest>();
    const caller = await this.authenticate(request.headers.authorization);
    request.caller = caller;
    const roles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES, targets) ?? [];
    if (roles.length > 0 && !roles.some((r) => caller.roles.includes(r))) {
      this.audit('auth.access_denied', { userId: caller.id });
      throw new ForbiddenException();
    }
    return true;
  }

  /**
   * Security event (NEST-SEC-33): pseudonymous id at most, never the token or its claims; traceId comes from the
   * log mixin. The product routes these lines to its audit trail (SEC-AUD-01).
   */
  private audit(event: string, fields: Readonly<Record<string, string>>): void {
    this.log.warn({ audit: event, ...fields }, 'Security event');
  }

  private async authenticate(header: string | undefined): Promise<Caller> {
    const token = /^Bearer ([\w.~+/-]+=*)$/.exec(header ?? '')?.[1];
    if (!token) {
      this.audit('auth.token_missing', {});
      throw new UnauthorizedException();
    }
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: this.cfg.AUTH_ISSUER,
        audience: this.cfg.AUTH_AUDIENCE,
        algorithms: ['RS256'],
        clockTolerance: this.cfg.AUTH_CLOCK_TOLERANCE_SECONDS,
        requiredClaims: ['sub', 'exp'],
      });
      const roles = Array.isArray(payload['roles']) ? payload['roles'].filter((r) => typeof r === 'string') : [];
      return { id: payload.sub ?? '', roles };
    } catch (err) {
      if (err instanceof KeySetUnavailable) {
        this.audit('auth.key_set_unavailable', { reason: reasonOf(err.cause) });
        throw new UnavailableError('identity provider key set unavailable', undefined, { cause: err.cause });
      }
      if (err instanceof errors.JOSEError) {
        this.audit('auth.token_rejected', { reason: err.code });
        throw new InvalidTokenException();
      }
      throw err; // fail closed
    }
  }
}
