// Bundle gate for `verify` (NG-TOOL-13): gzip budgets for the initial load and for lazy chunks, no source-map links,
// no config.json in the build output. Angular's own budgets (angular.json, NG-TOOL-05) measure raw size; this script
// measures what users download. Run after `ng build`; set DIST to the browser output folder.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = process.env.DIST ?? 'dist/app/browser'; // adapt the project name
const INITIAL_BUDGET_KB = 200; // gzip, entry chunk plus its modulepreloads: measured value + 10 %, reviewed change to raise
const LAZY_CHUNK_BUDGET_KB = 80; // gzip, each lazily loaded chunk

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const initial = new Set(
  [...html.matchAll(/(?:src|href)="(?:\.\/)?([^"]+\.js)"/g)].map((match) => match[1]).filter((p) => p !== undefined),
);
const chunks = readdirSync(DIST)
  .filter((file) => file.endsWith('.js'))
  .map((file) => {
    const code = readFileSync(join(DIST, file));
    return { path: file, code: code.toString('utf8'), gzipKb: gzipSync(code).length / 1024 };
  });

const failures = [];
const initialKb = chunks.filter((c) => initial.has(c.path)).reduce((sum, c) => sum + c.gzipKb, 0);
if (initialKb > INITIAL_BUDGET_KB) failures.push(`initial JS ${initialKb.toFixed(1)} kB gzip > ${INITIAL_BUDGET_KB} kB`);
for (const chunk of chunks) {
  const lazy = !initial.has(chunk.path);
  if (lazy && chunk.gzipKb > LAZY_CHUNK_BUDGET_KB) {
    failures.push(`${chunk.path} ${chunk.gzipKb.toFixed(1)} kB gzip > ${LAZY_CHUNK_BUDGET_KB} kB`);
  }
  if (chunk.code.includes('sourceMappingURL')) failures.push(`${chunk.path} links a source map (TS-SEC-05)`);
}
if (existsSync(join(DIST, 'config.json'))) failures.push('config.json is part of the build output (NG-CFG-06)');

for (const chunk of chunks) {
  console.log(`${initial.has(chunk.path) ? 'initial' : 'lazy   '} ${chunk.gzipKb.toFixed(1).padStart(7)} kB  ${chunk.path}`);
}
console.log(`initial total ${initialKb.toFixed(1)} kB gzip (budget ${INITIAL_BUDGET_KB} kB)`);
if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
