import type { Migration } from 'kysely/migration';

/**
 * Static list, in order (NEST-DB): `YYYY-MM-DDTHHmm_<name>`; forward-only (`up` only); never edit a merged migration.
 * Example: import * as m20261120T1200 from './2026-11-20T1200_create-orders.js'; then '2026-11-20T1200_create-orders': m20261120T1200
 */
export const migrations: Record<string, Migration> = {};
