#!/usr/bin/env node
// Claude Code PreToolUse hook (Edit|Write|MultiEdit), shipped by the quality baseline.
// In React SPA projects, reminds the agent once per session to load the baseline-react skill
// before the first edit of a source file in a React SPA component. Next.js components get baseline-nextjs-reminder instead.
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
if (!/\.(m?tsx?|css|html)$/.test(file)) process.exit(0);

// A React SPA component: a vite.config.ts using @vitejs/plugin-react, and no next.config.*, in the root or in a first-level component folder; the edited file lies inside it.
const read = (f) => { try { return fs.readFileSync(f, 'utf8'); } catch { return undefined; } };
const has = (dir, ...names) => names.some((n) => fs.existsSync(path.join(dir, n)));
const isComponent = (dir) => (read(path.join(dir, 'vite.config.ts')) ?? read(path.join(dir, 'vite.config.mts')))?.includes('@vitejs/plugin-react') === true
  && !has(dir, 'next.config.ts', 'next.config.mts', 'next.config.mjs', 'next.config.js');
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
const marker = path.join(os.tmpdir(), `claude-baseline-react-${session}`);
if (fs.existsSync(marker)) process.exit(0);
try { fs.writeFileSync(marker, ''); } catch { /* reminder still useful without the marker */ }

process.stdout.write(`${JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: 'Baseline reminder: before creating or editing React code, load the `baseline-react` skill (it loads the React, TanStack Query, MUI, Orval and accessibility skills) and follow docs/baseline/stacks/react.md (and the docs it lists). The baseline docs override the skills. Check for N+1 requests on data loading, work test-first (baseline-tdd), and finish with `npm run verify` from the component folder.',
  },
}, null, 2)}\n`);
