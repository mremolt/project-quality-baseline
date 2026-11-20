#!/usr/bin/env node
// Checks the baseline's Signal Store rules (docs/baseline/08-crosscutting-concepts/ui/angular-state-management.md) on the .ts files an eval run produced.
// Usage (Linux/macOS/Git Bash): arch.sh <outputs-dir>   (Windows CMD/PowerShell: arch.cmd <outputs-dir>)
//   exit 0 = clean; each violation printed as "<file>: <rule>: <what>"
// Store files = *-store.ts, *.store.ts, or any non-spec file calling signalStore(.
// Spec files  = *-store.spec.ts / *-store.test.ts (and *.store.spec.ts / *.store.test.ts).
// All files    = every .ts file (wiring, platform, factory and error-mapper rules).
// Needs: Node.js >= 22
import fs from 'node:fs';
import path from 'node:path';

if (!process.argv[2]) { console.error('usage: arch <outputs-dir>'); process.exit(2); }
const OUT = path.resolve(process.argv[2]);
const rel = (f) => path.relative(OUT, f).split(path.sep).join('/');
let fail = false;
const violation = (file, rule, message) => { console.log(`${rel(file)}: ${rule}: ${message}`); fail = true; };

const tsFiles = fs.readdirSync(OUT, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith('.ts'))
  .map((e) => path.join(e.parentPath, e.name))
  .sort();
const src = new Map(tsFiles.map((f) => [f, fs.readFileSync(f, 'utf8')]));

const stores = tsFiles.filter((f) => !/\.(spec|test)\.ts$/.test(f)
  && (/[-.]store\.ts$/.test(path.basename(f)) || /\bsignalStore\(/.test(src.get(f))));
const specs = tsFiles.filter((f) => /[-.]store\.(spec|test)\.ts$/.test(path.basename(f)));

if (stores.length === 0) {
  console.log('no store files found');
  process.exit(1);
}

// Patterns are matched per line (like grep): no pattern may cross a line break.
const Q = `['"]`;
const NQ = `[^'"\\n]*`;
for (const f of stores) {
  const s = src.get(f);
  const has = (re) => new RegExp(re, 'm').test(s);
  if (has(`from ${Q}@angular/common/http${Q}`)) violation(f, 'NG-STATE-02', 'imports @angular/common/http');
  if (has(`inject\\((HttpClient|HttpBackend)\\)`)) violation(f, 'NG-STATE-02', 'injects HttpClient');
  if (has(`from ${Q}${NQ}/adapter/out/`)) violation(f, 'NG-STATE-02', 'imports an outgoing adapter');
  if (has(`from ${Q}${NQ}/generated/`)) violation(f, 'NG-STATE-02', 'imports generated API code');
  if (has(`from ${Q}${NQ}/ports/out/`)) violation(f, 'NG-STATE-02', 'imports an outgoing port');
  if (has(`from ${Q}${NQ}[-.]store${Q}`)) violation(f, 'NG-STATE-02', 'imports another store');
  if (has(`inject\\([A-Z][A-Za-z0-9]*Store\\)`)) violation(f, 'NG-STATE-02', 'injects another store');
  if (has(`from ${Q}@ngrx/store${Q}`)) violation(f, 'NG-STATE-13', 'uses classic @ngrx/store');
  if (has(`providedIn:[ \\t]*${Q}root${Q}`) && !`/${rel(f)}`.includes('/platform/')) {
    violation(f, 'NG-STATE-12', "providedIn: 'root' outside src/platform");
  }
  if (has(`^[ \\t]*(export[ \\t]+)?type[ \\t]+[A-Za-z]*State[ \\t]*=[ \\t]*\\{`)) {
    violation(f, 'NG-STATE-05', 'state typed with a type literal instead of an interface');
  }
  if (has(`withState\\(\\{`)) violation(f, 'NG-STATE-05', 'withState without an explicit state type');
  if (has(`\\bawait |rxMethod|resource\\(`) && !has(`inject\\([A-Z][A-Z0-9_]+\\)`)) {
    violation(f, 'NG-STATE-02', 'async work without an injected use-case token (inject(UPPER_CASE_TOKEN))');
  }
}

// Rules for every file the run produced (specs included).
for (const f of tsFiles) {
  const s = src.get(f);
  const r = `/${rel(f)}`;
  const has = (re) => new RegExp(re, 'm').test(s);
  if (has(`from ${Q}${NQ}\\.(providers|composition)${Q}`) && !/\.routes\.ts$|\/app\/|\/index\.ts$/.test(r)) {
    violation(f, 'TS-ARCH-17', 'imports tokens or wiring from the providers file; use <feature>.tokens.ts');
  }
  if (!r.includes('/platform/') && has(`from ${Q}${NQ}/platform/(?!domain${Q}|domain/index${Q}|index${Q})[^'"\n]+${Q}`)) {
    violation(f, 'NG-ARCH-04', 'deep import into src/platform; import from src/platform/index.ts');
  }
  // Relative imports resolved against the file, so '../../out/http/x' counts as adapter/out too.
  const targets = [...s.matchAll(/from ['"](\.[^'"\n]+)['"]/g)].map((m) => path.posix.join(path.posix.dirname(r), m[1]));
  if (r.includes('/adapter/in/') && (has(`from ${Q}${NQ}/adapter/out/`) || targets.some((t) => t.includes('/adapter/out/')))) {
    violation(f, 'TS-ARCH-12', 'UI adapter imports an outgoing adapter (ui-and-http-adapters-independent)');
  }
  if (/error-keys\.ts$/.test(r) && !r.includes('/platform/') && has(`providedIn:[ \\t]*${Q}root${Q}`)) {
    violation(f, 'NG-STATE-09', "feature error mapper providedIn: 'root'; list it in <feature>.providers.ts");
  }
  if (has(`\\bof\\b[^\\n]*\\(\\s*\\w+\\??\\s*:\\s*unknown\\s*\\)`)) {
    violation(f, 'TS-ARCH-06', 'command/query factory typed unknown; use z.input<typeof Schema>');
  }
}

for (const f of specs) {
  const s = src.get(f);
  const has = (re) => new RegExp(re, 'm').test(s);
  if (!has(`from ${Q}vitest-mock-extended${Q}`)) violation(f, 'TS-TEST-01', 'does not use vitest-mock-extended');
  if (!has(`mock<[A-Za-z]+>\\(\\)`)) violation(f, 'TS-TEST-01', 'no mock<Contract>() double');
  if (has(`\\bvi\\.mock\\(`)) violation(f, 'TS-TEST-02', 'uses vi.mock');
  if (has(`HttpTestingController|provideHttpClientTesting`)) violation(f, 'NG-STATE-14', 'mocks HTTP instead of use cases');
}

if (!fail) console.log(`arch: clean (${stores.length} store file(s), ${specs.length} spec file(s))`);
process.exit(fail ? 1 : 0);
