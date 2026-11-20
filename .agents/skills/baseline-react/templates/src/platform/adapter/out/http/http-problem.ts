import { z } from 'zod';

/** The fields of an `application/problem+json` body the frontend relies on (API-REST-07). */
export const ProblemSchema = z.object({
  code: z.string().optional(),
  traceId: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), code: z.string() })).optional(),
});
export type Problem = z.infer<typeof ProblemSchema>;

/** A 4xx answer the feature's HTTP adapter maps to a domain error (TS-ARCH-18). Never leaves `adapter/out/http`. */
export class HttpProblem extends Error {
  override readonly name = 'HttpProblem';

  constructor(
    readonly status: number,
    readonly problem: Problem,
  ) {
    super(['HTTP', String(status), problem.code].filter(Boolean).join(' '));
  }
}
