#!/usr/bin/env node
// Claude Code PreToolUse hook (Edit|Write|MultiEdit), shipped by the quality baseline.
// In Angular projects, reminds the agent once per session to load the baseline-angular skill
// before the first edit of an Angular source file. Never blocks.
// Runs with Node.js on Linux, macOS and Windows (no bash or jq needed).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let input = {};
try { input = JSON.parse(raw); } catch { process.exit(0); }

const project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
if (!fs.existsSync(path.join(project, 'angular.json'))) process.exit(0);

const file = input?.tool_input?.file_path ?? '';
if (!/\.(ts|html|scss|css)$/.test(file)) process.exit(0);

const session = String(input?.session_id ?? 'unknown').replace(/[^A-Za-z0-9_-]/g, '');
const marker = path.join(os.tmpdir(), `claude-baseline-angular-${session}`);
if (fs.existsSync(marker)) process.exit(0);
try { fs.writeFileSync(marker, ''); } catch { /* reminder still useful without the marker */ }

process.stdout.write(`${JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: 'Baseline reminder: before creating or editing Angular code, load the `baseline-angular` skill (it loads angular-developer and the other skills) and follow docs/baseline/stacks/angular.md (and the docs it lists). The baseline docs override the skills. Check for N+1 requests on data loading and work test-first (baseline-tdd).',
  },
}, null, 2)}\n`);
