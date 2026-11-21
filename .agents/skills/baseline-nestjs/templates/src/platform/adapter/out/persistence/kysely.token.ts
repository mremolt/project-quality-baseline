/**
 * Injection token of the one Kysely instance (NEST-DB-04). Only platform persistence, the scheduling adapters (cluster
 * lock) and the readiness check inject it; context persistence adapters use KyselyTransactionAdapter.executor()
 * (dependency-cruiser rule kysely-token-only-in-persistence).
 */
export const KYSELY = Symbol('Kysely');
