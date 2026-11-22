#!/usr/bin/env node
// Runs npm scripts one after another and reports every failure at the end (TS-TOOL-10, TS-TOOL-18):
//   node scripts/verify.mjs generate:api! format:check lint typecheck check:arch test build! check:bundle
// A failing step does not stop the run, so format, lint, architecture and test findings show up in one pass.
// A step ending in `!` is a gate: later steps need its output (generated client, build), so a failure stops there.
// The exit code is non-zero if any step failed; every check still fails the build.
import { spawnSync } from 'node:child_process';

const steps = process.argv.slice(2);
if (steps.length === 0) {
  console.error('Usage: node scripts/verify.mjs <script>[!] ...');
  process.exit(2);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const results = [];
for (const step of steps) {
  const gate = step.endsWith('!');
  const script = gate ? step.slice(0, -1) : step;
  const started = Date.now();
  console.log(`\n▶ npm run ${script}`);
  const run = spawnSync(npm, ['run', script], { stdio: 'inherit', shell: process.platform === 'win32' });
  const ok = run.status === 0;
  results.push({ script, ok, seconds: ((Date.now() - started) / 1000).toFixed(1) });
  if (!ok && gate) {
    console.error(`\n✖ ${script} failed; the remaining steps need it and were skipped.`);
    break;
  }
}

console.log('\nverify summary');
for (const { script, ok, seconds } of results) {
  console.log(`  ${ok ? '✔' : '✖'} ${script} (${seconds} s)`);
}
const skipped = steps.length - results.length;
if (skipped > 0) console.log(`  … ${skipped} step(s) skipped after a failed gate`);
const failed = results.filter((r) => !r.ok).map((r) => r.script);
if (failed.length > 0 || skipped > 0) {
  console.error(`\nverify failed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log('\nverify passed');
