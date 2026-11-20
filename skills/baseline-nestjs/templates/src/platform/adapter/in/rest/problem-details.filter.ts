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
import { RequestValidationError } from './request-validation.js';
import { currentTraceId } from './trace-id.js';

interface Problem {
  readonly status: number;
  readonly code?: string;
  readonly errors?: readonly { field: string; code: string }[];
  readonly retryAfterSeconds?: number;
}

/** RFC 9457 problems for every error (NEST-REST, ARCH-UC-13). Titles are fixed per status, never an error message. */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly log = new Logger(ProblemDetailsFilter.name);

  catch(error: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const { retryAfterSeconds, ...problem } = this.toProblem(error, http.getRequest<FastifyRequest>());
    if (problem.status >= 500) this.log.error(error);
    const reply = http.getResponse<FastifyReply>();
    if (retryAfterSeconds !== undefined) void reply.header('retry-after', String(retryAfterSeconds));
    void reply
      .status(problem.status)
      .header('content-type', 'application/problem+json')
      .send({ ...problem, title: STATUS_CODES[problem.status], traceId: currentTraceId() });
  }

  private toProblem(error: unknown, request: FastifyRequest): Problem {
    if (error instanceof RequestValidationError) return { status: 400, errors: error.errors };
    if (error instanceof DomainValidationError) {
      return { status: 400, code: error.code, errors: error.field ? [{ field: error.field, code: error.code }] : [] };
    }
    if (error instanceof NotFoundError) return { status: 404, code: error.code };
    if (error instanceof ConflictError) return { status: request.headers['if-match'] ? 412 : 409, code: error.code };
    if (error instanceof BusinessRuleError) return { status: 409, code: error.code };
    if (error instanceof UnavailableError) return { status: 503, retryAfterSeconds: error.retryAfterSeconds ?? 5 };
    // Fastify's 4xx (invalid JSON, 413, 415), unknown routes, guards: status only, never the message
    if (error instanceof HttpException && error.getStatus() < 500) return { status: error.getStatus() };
    // Fastify plugins (rate limit, CSRF, multipart) throw errors with a statusCode that are no HttpException
    const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) return { status: statusCode };
    return { status: 500 }; // a bug or technical failure: generic body
  }
}
