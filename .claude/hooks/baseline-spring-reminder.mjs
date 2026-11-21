#!/usr/bin/env node
// Claude Code PreToolUse hook (Edit|Write|MultiEdit), shipped by the quality baseline.
// In Spring Boot projects, reminds the agent once per session to load the baseline-spring skill
// before the first edit of a Java, pom.xml, Flyway or Spring configuration file. Never blocks.
// Runs with Node.js on Linux, macOS and Windows (no bash or jq needed).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
let input = {};
try { input = JSON.parse(raw); } catch { process.exit(0); }

const project = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const file = input?.tool_input?.file_path ?? '';
if (!/(\.java|pom\.xml|\.sql|application[^/\\]*\.ya?ml|application[^/\\]*\.properties|compose[^/\\]*\.ya?ml)$/.test(file)) process.exit(0);

// A Spring Boot project: a pom.xml mentioning spring-boot in the root or in a first-level component folder.
const candidates = [project];
try {
  for (const e of fs.readdirSync(project, { withFileTypes: true })) {
    if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') candidates.push(path.join(project, e.name));
  }
} catch { process.exit(0); }
const isSpring = candidates.some((dir) => {
  try { return fs.readFileSync(path.join(dir, 'pom.xml'), 'utf8').includes('spring-boot'); } catch { return false; }
});
if (!isSpring) process.exit(0);

const session = String(input?.session_id ?? 'unknown').replace(/[^A-Za-z0-9_-]/g, '');
const marker = path.join(os.tmpdir(), `claude-baseline-spring-${session}`);
if (fs.existsSync(marker)) process.exit(0);
try { fs.writeFileSync(marker, ''); } catch { /* reminder still useful without the marker */ }

process.stdout.write(`${JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: 'Baseline reminder: before creating or editing Java/Spring code, load the `baseline-spring` skill (it loads the other Spring skills) and read the rule index in docs/baseline/rule-index/ (shared, java and spring); open full docs only for the topics the task touches, from the task table of the skill (TOOL-SKL-10). The baseline docs override the skills. Check for N+1 requests on data loading, work test-first (baseline-tdd), and finish with `./mvnw verify` from the component folder.',
  },
}, null, 2)}\n`);
