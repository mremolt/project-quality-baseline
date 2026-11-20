import { StandardSchemaValidationPipe } from '@nestjs/common';
import type { StandardSchemaV1 } from '@standard-schema/spec';
import { z } from 'zod';

/** A request that cannot be mapped: 400 with field errors (NEST-REST). */
export class RequestValidationError extends Error {
  constructor(readonly errors: readonly { field: string; code: string }[]) {
    super('Request validation failed');
  }
}

// zod reports a missing value as invalid_type; tag it so it becomes REQUIRED.
z.config({ customError: (issue) => (issue.input === undefined ? 'REQUIRED' : undefined) });

function apiCode(issue: StandardSchemaV1.Issue): string {
  if (issue.message === 'REQUIRED') return 'REQUIRED';
  const { code, origin } = issue as { code?: string; origin?: string };
  const isLength = origin === 'string' || origin === 'array';
  switch (code) {
    case 'too_big':
      return isLength ? 'TOO_LONG' : 'TOO_LARGE';
    case 'too_small':
      return isLength ? 'TOO_SHORT' : 'TOO_SMALL';
    case 'invalid_format':
      return 'INVALID_FORMAT';
    case 'invalid_value':
      return 'INVALID_VALUE';
    case 'invalid_type':
      return 'INVALID_TYPE';
    default:
      return 'INVALID';
  }
}

export const requestValidationPipe = new StandardSchemaValidationPipe({
  exceptionFactory: (issues) =>
    new RequestValidationError(
      issues.map((issue) => ({
        field: (issue.path ?? []).map((p) => String(typeof p === 'object' ? p.key : p)).join('.'),
        code: apiCode(issue),
      })),
    ),
});
