import { z } from 'zod';

/** The fields of an `application/problem+json` body the frontend relies on (API-REST-07, REACT-API-08). */
export const ProblemSchema = z.object({
  status: z.number().int().optional(),
  code: z.string().max(100).optional(),
  traceId: z.string().max(100).optional(),
  errors: z
    .array(z.object({ field: z.string().max(200), code: z.string().max(100) }))
    .max(100)
    .optional(),
});
export type Problem = z.output<typeof ProblemSchema>;

/**
 * A non-2xx answer of the backend. Only the feature's error mapper (TS-ARCH-18) looks at it;
 * use cases, stores and components see domain errors.
 */
export class HttpProblem extends Error {
  override readonly name = 'HttpProblem';

  constructor(
    readonly status: number,
    readonly problem: Problem,
  ) {
    super(['HTTP', String(status), problem.code].filter(Boolean).join(' '));
  }
}

/** Reads the problem body of a non-2xx response; a body that is not a problem gives an empty problem. */
export async function readProblem(response: Response): Promise<Problem> {
  const isProblem = response.headers.get('content-type')?.startsWith('application/problem+json') ?? false;
  const body: unknown = isProblem ? await response.json().catch(() => ({})) : {};
  const parsed = ProblemSchema.safeParse(body);
  return parsed.success ? parsed.data : {};
}
