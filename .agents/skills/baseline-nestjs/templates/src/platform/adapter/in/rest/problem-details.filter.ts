import { STATUS_CODES } from 'node:http';

import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import {
  BusinessRuleError,
  ConflictError,
  DomainValidationError,
  NotFoundError,
  UnavailableError,
} from '../../../domain/index.js';
import { InvalidTokenException } from './auth.guard.js';
import { RequestValidationError } from './request-validation.js';
import { currentTraceId } from './trace-id.js';

interface Problem {
  readonly status: number;
  readonly code?: string;
  readonly errors?: readonly { field: string; code: string }[];
  readonly headers?: Readonly<Record<string, string>>;
}

const unavailable = (retryAfterSeconds = 5): Problem => ({
  status: 503,
  headers: { 'retry-after': String(retryAfterSeconds) },
});

/** RFC 9457 problems for every error (NEST-REST, ARCH-UC-13). Titles are fixed per status, never an error message. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly log = new Logger(ProblemDetailsFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const { headers = {}, ...problem } = this.toProblem(error, http.getRequest<FastifyRequest>());
    this.logOnce(error, problem);
    const reply = http.getResponse<FastifyReply>();
    for (const [name, value] of Object.entries(headers)) void reply.header(name, value);
    void reply
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send({ ...problem, title: STATUS_CODES[problem.status], traceId: currentTraceId() });
  }

  /** The one log line of an error (NEST-LOG-08): 4xx at info, 503 at warn, both without a stack; 500 at error. */
  private logOnce(error: unknown, problem: Omit<Problem, 'headers'>): void {
    const fields = { status: problem.status, ...(problem.code === undefined ? {} : { code: problem.code }) };
    if (problem.status === 500) this.log.error({ err: error }, 'Unhandled error');
    else if (problem.status === 503) this.log.warn(fields, 'Temporarily unavailable');
    else this.log.log(fields, 'Request rejected');
  }

  private toProblem(error: unknown, request: FastifyRequest): Problem {
    return this.categoryProblem(error, request) ?? this.transportProblem(error);
  }

  /** The error categories of src/platform/domain and the request validation (ARCH-UC-13, NODE-ARCH-07). */
  private categoryProblem(error: unknown, request: FastifyRequest): Problem | undefined {
    if (error instanceof RequestValidationError) return { status: 400, errors: error.errors };
    if (error instanceof DomainValidationError) {
      return { status: 400, code: error.code, errors: error.field ? [{ field: error.field, code: error.code }] : [] };
    }
    if (error instanceof NotFoundError) return { status: 404, code: error.code };
    if (error instanceof ConflictError) return { status: request.headers['if-match'] ? 412 : 409, code: error.code };
    if (error instanceof BusinessRuleError) return { status: 409, code: error.code };
    if (error instanceof UnavailableError) return unavailable(error.retryAfterSeconds); // also the key set outage (NEST-SEC-04)
    return undefined;
  }

  /**
   * Fastify's 4xx (invalid JSON, 413, 415), unknown routes, guards: status only, never the message. Fastify plugins
   * (rate limit, CSRF, multipart) throw errors with a statusCode that are no HttpException. Every 401 carries the
   * RFC 6750 challenge (NEST-SEC-04). 503 passes through: Terminus readiness (database down, drain), Fastify
   * handlerTimeout (NEST-OBS-03, NEST-SEC-22). Anything else is a bug or technical failure: generic 500.
   */
  private transportProblem(error: unknown): Problem {
    if (error instanceof InvalidTokenException) {
      return { status: 401, headers: { 'www-authenticate': 'Bearer error="invalid_token"' } };
    }
    const status = error instanceof HttpException ? error.getStatus() : statusCodeOf(error);
    if (status === 401) return { status, headers: { 'www-authenticate': 'Bearer' } };
    if (status !== undefined && status >= 400 && status < 500) return { status };
    if (status === 503) return unavailable();
    return { status: 500 };
  }
}

function statusCodeOf(error: unknown): number | undefined {
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}
