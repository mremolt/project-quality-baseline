// NEXT-TOOL-08: gzip budgets over the client chunks of `next build`, no source maps (TS-SEC-05, NEXT-OBS-17).
// Runs after `next build` in `verify`; fails the run when a budget is exceeded. Budgets are per product.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET = { totalKiB: 400, largestChunkKiB: 150 };
const dir = '.next/static';

const files = readdirSync(dir, { recursive: true }).map(String);
const chunks = files
  .filter((file) => file.startsWith('chunks/') && file.endsWith('.js'))
  .map((file) => {
    const content = readFileSync(join(dir, file));
    return { file, kib: gzipSync(content).length / 1024, sourceMapLink: content.includes('sourceMappingURL') };
  });
const total = chunks.reduce((sum, chunk) => sum + chunk.kib, 0);
const largest = chunks.reduce((max, chunk) => (chunk.kib > max.kib ? chunk : max), { file: '', kib: 0 });

console.log(`client JS (gzip): total ${total.toFixed(1)} KiB, largest ${largest.file} ${largest.kib.toFixed(1)} KiB`);
const failures = [
  total > BUDGET.totalKiB && `total ${total.toFixed(1)} KiB > ${String(BUDGET.totalKiB)} KiB`,
  largest.kib > BUDGET.largestChunkKiB &&
    `largest chunk ${largest.kib.toFixed(1)} KiB > ${String(BUDGET.largestChunkKiB)} KiB`,
  ...chunks.filter((chunk) => chunk.sourceMapLink).map((chunk) => `sourceMappingURL in ${chunk.file}`),
  ...files.filter((file) => file.endsWith('.map')).map((file) => `source map ${file} is served`),
].filter(Boolean);
if (failures.length > 0) {
  console.error(`bundle check failed: ${failures.join('; ')}`);
  process.exit(1);
}
