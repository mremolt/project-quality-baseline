import type { Migration } from 'kysely/migration';

import * as m20261121T0000 from './2026-11-21T0000_grant-runtime-role.js';

/**
 * Static list, in order (NEST-DB-14): `YYYY-MM-DDTHHmm_<name>`; forward-only (`up` only); never edit a merged
 * migration (NEST-DB-19). The first migration grants the DML user its privileges (NEST-DB-17).
 */
export const migrations: Record<string, Migration> = {
  '2026-11-21T0000_grant-runtime-role': m20261121T0000,
};
