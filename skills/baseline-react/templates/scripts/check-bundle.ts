// Bundle gate for `verify`: size budgets, lazy features stay out of the initial load, no shipped source-map links.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const INITIAL_BUDGET_KB = 230; // gzip, entry chunk plus its modulepreloads
const LAZY_CHUNK_BUDGET_KB = 80; // gzip, each lazily loaded chunk
const FEATURE_MARKER = '/api/v1/'; // feature HTTP adapters (TS-ARCH-20); the platform only fetches /config.json

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const initial = new Set(
  [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)]
    .map((match) => match[1])
    .filter((path) => path !== undefined),
);
const chunks = readdirSync(join(DIST, 'assets'))
  .filter((file) => file.endsWith('.js'))
  .map((file) => {
    const path = `assets/${file}`;
    const code = readFileSync(join(DIST, path));
    return { path, code: code.toString('utf8'), gzipKb: gzipSync(code).length / 1024 };
  });

const failures: string[] = [];
const initialKb = chunks.filter((chunk) => initial.has(chunk.path)).reduce((sum, chunk) => sum + chunk.gzipKb, 0);
if (initialKb > INITIAL_BUDGET_KB)
  failures.push(`initial JS ${initialKb.toFixed(1)} kB gzip > ${String(INITIAL_BUDGET_KB)} kB`);
for (const chunk of chunks) {
  const lazy = !initial.has(chunk.path);
  if (lazy && chunk.gzipKb > LAZY_CHUNK_BUDGET_KB) {
    failures.push(`${chunk.path} ${chunk.gzipKb.toFixed(1)} kB gzip > ${String(LAZY_CHUNK_BUDGET_KB)} kB`);
  }
  if (!lazy && chunk.code.includes(FEATURE_MARKER))
    failures.push(`${chunk.path} is loaded initially but holds feature code`);
  if (chunk.code.includes('sourceMappingURL')) failures.push(`${chunk.path} links a source map (TS-SEC-05)`);
}
if (existsSync(join(DIST, 'config.json'))) failures.push('config.json is part of the build output (CFG-02)');

for (const chunk of chunks) {
  console.log(
    `${initial.has(chunk.path) ? 'initial' : 'lazy   '} ${chunk.gzipKb.toFixed(1).padStart(7)} kB  ${chunk.path}`,
  );
}
console.log(`initial total ${initialKb.toFixed(1)} kB gzip (budget ${String(INITIAL_BUDGET_KB)} kB)`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
