import type { z } from 'zod';

import { DomainValidationError } from '../domain/index.js';

/** Parses with a zod schema; the first issue becomes a DomainValidationError, so no ZodError leaves the core (NODE-ARCH-06). */
export function parseOrThrow<S extends z.ZodType>(schema: S, input: z.input<S>): z.output<S> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const field = issue?.path.map(String).join('.');
  throw new DomainValidationError(
    issue?.code === 'invalid_type' ? 'REQUIRED' : 'INVALID',
    field === '' ? undefined : field,
  );
}
