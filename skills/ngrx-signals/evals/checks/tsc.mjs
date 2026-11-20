#!/usr/bin/env node
// Type-checks every .ts file an eval run produced against @ngrx/signals 22 / Angular 22.
// Adapted from danielsogl/skills: adds vitest-mock-extended + zod (our test/validation defaults, TS-TEST-01, TS-D2)
// and stubs that also allow static members (LoadOrderHistoryQuery.of(...)) on missing modules.
// Usage (Linux/macOS/Git Bash): tsc.sh <outputs-dir>   (Windows CMD/PowerShell: tsc.cmd <outputs-dir>)
//   exit 0 = clean; errors printed as tsc reports them
// Relative imports the run never wrote (e.g. './book.model' the prompt says already exists)
// are stubbed as `any`, so every remaining error is a real one.
// Env: CHECK_DEPS = dependency cache dir (default: <os temp>/ngrx-signals-baseline-check-deps)
// Needs: Node.js >= 22, npm
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (!process.argv[2]) { console.error('usage: tsc <outputs-dir>'); process.exit(2); }
const OUT = path.resolve(process.argv[2]);
const DEPS = path.resolve(process.env.CHECK_DEPS || path.join(os.tmpdir(), 'ngrx-signals-baseline-check-deps'));

if (!fs.existsSync(path.join(DEPS, 'node_modules', 'vitest-mock-extended'))) {
  fs.mkdirSync(DEPS, { recursive: true });
  // npm is npm.cmd on Windows, which Node only spawns through a shell.
  const npm = (...args) => {
    const r = spawnSync('npm', args, { cwd: DEPS, stdio: ['ignore', 'ignore', 'inherit'], shell: process.platform === 'win32' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  };
  npm('init', '-y');
  npm('i', '--silent',
    '@ngrx/signals@22', '@ngrx/operators@22', '@angular/core@22', '@angular/common@22',
    '@angular/platform-browser@22', 'rxjs', 'typescript@~6.0', 'vitest@5', 'vitest-mock-extended', 'zod', '@types/jest');
}

// Work dir lives inside DEPS so imports resolve from its node_modules.
const WORK = fs.mkdtempSync(path.join(DEPS, 'run-'));
fs.cpSync(OUT, WORK, { recursive: true, filter: (src) => fs.statSync(src).isDirectory() || src.endsWith('.ts') });
process.chdir(WORK);

const tsFiles = fs.readdirSync('.', { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.ts'))
  .map((e) => path.join(e.parentPath, e.name));

// ponytail: jest-vs-vitest globals picked by grep; a spec mixing both still fails, which is correct.
const types = tsFiles.some((f) => /\bjest\./.test(fs.readFileSync(f, 'utf8'))) ? '"jest"' : '"vitest/globals"';
fs.writeFileSync('tsconfig.json', `{ "compilerOptions": { "strict": true, "noEmit": true, "target": "es2022", "module": "esnext",
  "moduleResolution": "bundler", "lib": ["es2022", "dom"], "skipLibCheck": true, "types": [${types}] },
  "include": ["**/*.ts"] }
`);

console.log(`tsc work dir: ${WORK}`);
const tscBin = path.join(DEPS, 'node_modules', 'typescript', 'bin', 'tsc');
const first = spawnSync(process.execPath, [tscBin, '-p', '.'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync('first.log', first.stdout ?? '');
if (first.status === 0) { console.log('tsc: clean'); process.exit(0); }

// Stub each missing relative module with the names its importers use, then re-check.
const missing = [...new Set(
  [...(first.stdout ?? '').matchAll(/^(.+?)\(\d+,\d+\): error TS2307: Cannot find module '(\.[^']+)'/gm)]
    .map((m) => JSON.stringify([m[1], m[2]])),
)].sort().map((s) => JSON.parse(s));
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Several files may import different names from the same missing module: collect per target first.
const targets = new Map();
for (const [srcFile, spec] of missing) {
  const target = `${path.normalize(path.join(path.dirname(srcFile), spec))}.ts`; // "./book.model" -> book.model.ts
  if (!targets.has(target)) targets.set(target, { names: new Set(), hasDefault: false });
  const t = targets.get(target);
  const re = new RegExp(`import\\s+(?:type\\s+)?(\\w+)?\\s*,?\\s*(?:\\{([^}]*)\\})?\\s*from\\s*['"]${escapeRe(spec)}['"]`, 'g');
  for (const m of fs.readFileSync(srcFile, 'utf8').matchAll(re)) {
    t.hasDefault ||= !!m[1] && m[1] !== 'type';
    for (const n of (m[2] ?? '').split(',')) {
      if (n.trim()) t.names.add(n.trim().replace(/^type /, '').split(' as ')[0].trim());
    }
  }
}
for (const [target, { names, hasDefault }] of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  // ponytail: every name is `any` as a type and, as a value, callable + constructible (inject() token, `new`,
  // factory functions) with any static member (`Query.of(...)`); a stub can't catch misuse of the missing module.
  const sorted = [...names].sort();
  const lines = sorted.map((n) => `export type ${n} = any;\nexport const ${n}: ((...args: any[]) => any) & (new (...args: any[]) => any) & Record<string, any> = undefined as any;`);
  if (hasDefault) lines.push('export default undefined as any;');
  fs.writeFileSync(target, `${lines.join('\n')}\n`);
  console.log(`stubbed missing module ${target} (${sorted.join(', ') || 'default'})`);
}

const second = spawnSync(process.execPath, [tscBin, '-p', '.'], { stdio: 'inherit' });
if (second.status !== 0) process.exit(second.status ?? 1);
console.log('tsc: clean');
