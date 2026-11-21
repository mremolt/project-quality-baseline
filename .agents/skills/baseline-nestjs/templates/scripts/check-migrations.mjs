// NEST-DB-19: a migration is immutable once it is on the base branch (Kysely keeps no checksums).
// Part of `npm run verify`; CI runs it with the base branch fetched (MIGRATIONS_BASE_REF, default origin/main).
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const DIR = 'src/platform/adapter/out/persistence/migrations';
const NAME = /^\d{4}-\d{2}-\d{2}T\d{4}_[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/;

/**
 * Violations of NEST-DB-19 in the changes of the migrations folder against the base branch.
 * @param {readonly { status: string; path: string }[]} changes git name-status entries (status letter, path)
 * @param {string | undefined} newestOnBase newest migration file name on the base branch
 * @returns {string[]}
 */
export function findViolations(changes, newestOnBase) {
  const violations = [];
  for (const { status, path } of changes) {
    const name = basename(path);
    if (name === 'index.ts') continue; // the static list grows with every migration
    if (status !== 'A') violations.push(`${name}: changed (${status}); a merged migration is immutable, add a new one`);
    else if (!NAME.test(name)) violations.push(`${name}: name must match YYYY-MM-DDTHHmm_<kebab-name>.ts`);
    else if (newestOnBase !== undefined && name <= newestOnBase) {
      violations.push(`${name}: sorts before ${newestOnBase} on the base branch; use a later timestamp`);
    }
  }
  return violations;
}

/** @param {string[]} args */
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
/** @param {string} text */
const lines = (text) => text.split('\n').filter(Boolean);

function main() {
  const base = process.env.MIGRATIONS_BASE_REF ?? 'origin/main';
  try {
    git('rev-parse', '--verify', '--quiet', `${base}^{commit}`);
  } catch {
    if (process.env.CI) {
      console.error(`check-migrations: base ${base} not found; fetch it before verify (NEST-DB-19)`);
      process.exit(1);
    }
    console.warn(`check-migrations: base ${base} not found (new repository?); skipped locally, CI fails here`);
    return;
  }
  // Committed and uncommitted changes since the merge base, plus new files not yet added
  const changed = lines(git('diff', '--name-status', '--no-renames', '--merge-base', base, '--', DIR)).map((line) => {
    const [status = '', path = ''] = line.split('\t');
    return { status: status.charAt(0), path };
  });
  const untracked = lines(git('ls-files', '--others', '--exclude-standard', '--', DIR)).map((path) => ({
    status: 'A',
    path,
  }));
  const onBase = lines(git('ls-tree', '--name-only', base, `${DIR}/`))
    .map((path) => basename(path))
    .filter((name) => NAME.test(name))
    .sort();
  const violations = findViolations([...changed, ...untracked], onBase.at(-1));
  if (violations.length > 0) {
    console.error(`check-migrations against ${base} (NEST-DB-19):\n  ${violations.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`check-migrations: ${String(changed.length + untracked.length)} change(s) against ${base}, all valid`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
