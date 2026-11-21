import { describe, expect, it } from 'vitest';

import { findViolations } from './check-migrations.mjs';

const dir = 'src/platform/adapter/out/persistence/migrations';
const newest = '2026-11-21T0000_grant-runtime-role.ts';

describe('check-migrations (NEST-DB-19)', () => {
  it('accepts new migrations that sort after the newest one on the base branch, and index.ts edits', () => {
    expect(
      findViolations(
        [
          { status: 'A', path: `${dir}/2026-12-01T0930_create-orders.ts` },
          { status: 'M', path: `${dir}/index.ts` },
        ],
        newest,
      ),
    ).toEqual([]);
  });

  it('rejects a changed or deleted migration', () => {
    expect(findViolations([{ status: 'M', path: `${dir}/${newest}` }], newest)).toEqual([
      `${newest}: changed (M); a merged migration is immutable, add a new one`,
    ]);
    expect(findViolations([{ status: 'D', path: `${dir}/${newest}` }], newest)).toHaveLength(1);
  });

  it('rejects a new name outside the pattern', () => {
    expect(findViolations([{ status: 'A', path: `${dir}/create_orders.ts` }], newest)).toEqual([
      'create_orders.ts: name must match YYYY-MM-DDTHHmm_<kebab-name>.ts',
    ]);
  });

  it('rejects a new migration that sorts before the newest one on the base branch', () => {
    expect(findViolations([{ status: 'A', path: `${dir}/2026-11-20T1200_late.ts` }], newest)).toEqual([
      `2026-11-20T1200_late.ts: sorts before ${newest} on the base branch; use a later timestamp`,
    ]);
  });

  it('accepts anything new when the base branch has no migration yet', () => {
    expect(findViolations([{ status: 'A', path: `${dir}/2026-01-01T0000_first.ts` }], undefined)).toEqual([]);
  });
});
