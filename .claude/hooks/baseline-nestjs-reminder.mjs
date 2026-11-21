#!/usr/bin/env node
// Claude Code PreToolUse hook (Edit|Write|MultiEdit), shipped by the quality baseline.
// In NestJS projects, reminds the agent once per session to load the baseline-nestjs skill
// before the first edit of a source, package, configuration or Compose file in a NestJS component.
// Never blocks. Runs with Node.js on Linux, macOS and Windows (no bash or jq needed).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let input = {};
try { input = JSON.parse(raw); } catch { process.exit(0); }

const project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const file = input?.tool_input?.file_path ?? '';
if (!/(\.(m?ts|json|sql|ya?ml)|Dockerfile)$/.test(file)) process.exit(0);

// A NestJS component: a package.json mentioning @nestjs/core in the root or in a first-level component folder; the edited file lies inside it.
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return undefined; } };
const isComponent = (dir) => read(path.join(dir, 'package.json'))?.includes('@nestjs/core') ?? false;
const candidates = [project];
try {
  for (const e of fs.readdirSync(project, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') candidates.push(path.join(project, e.name));
  }
} catch { process.exit(0); }
const target = path.resolve(project, file);
const inComponent = candidates.filter(isComponent).some((dir) => target === dir || target.startsWith(dir + path.sep));
if (!inComponent) process.exit(0);

const session = String(input?.session_id ?? 'unknown').replace(/[^A-Za-z0-9_-]/g, '');
const marker = path.join(os.tmpdir(), `claude-baseline-nestjs-${session}`);
if (fs.existsSync(marker)) process.exit(0);
try { fs.writeFileSync(marker, ''); } catch { /* reminder still useful without the marker */ }

process.stdout.write(`${JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: 'Baseline reminder: before creating or editing NestJS backend code, load the `baseline-nestjs` skill (it loads baseline-tdd, vitest and baseline-security) and follow docs/baseline/stacks/nestjs.md (and the docs it lists). The baseline docs override the skills and the NestJS docs. Check for N+1 requests on data loading, work test-first (baseline-tdd), and finish with `npm run verify` from the component folder.',
  },
}, null, 2)}\n`);
