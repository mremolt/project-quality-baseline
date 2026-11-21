#!/usr/bin/env node
// Claude Code PreToolUse hook (Edit|Write|MultiEdit), shipped by the quality baseline.
// In Next.js projects, reminds the agent once per session to load the baseline-nextjs skill
// before the first edit of a source file in a Next.js component.
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
if (!/\.(m?tsx?|css|json)$/.test(file)) process.exit(0);

// A Next.js component: a next.config.* in the root or in a first-level component folder; the edited file lies inside it.
const has = (dir, ...names) => names.some((n) => fs.existsSync(path.join(dir, n)));
const isComponent = (dir) => has(dir, 'next.config.ts', 'next.config.mts', 'next.config.mjs', 'next.config.js');
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
const marker = path.join(os.tmpdir(), `claude-baseline-nextjs-${session}`);
if (fs.existsSync(marker)) process.exit(0);
try { fs.writeFileSync(marker, ''); } catch { /* reminder still useful without the marker */ }

process.stdout.write(`${JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: 'Baseline reminder: before creating or editing Next.js code, load the `baseline-nextjs` skill (it loads the React skills and routes to the Next.js docs) and read the rule index in docs/baseline/rule-index/ (shared, typescript, react and nextjs); open full docs only for the topics the task touches, from the task table of the skill (TOOL-SKL-10). The baseline docs override the skills and the Next.js docs. Check for N+1 requests on data loading, work test-first (baseline-tdd), and finish with `npm run verify` from the component folder.',
  },
}, null, 2)}\n`);
