#!/usr/bin/env node
// Shows what changed upstream since our own skills were adapted from third-party skills.
//
// Each adapted skill in skills/<name>/SKILL.md records its origin in the frontmatter:
//   metadata:
//     upstream-repo: owner/repo
//     upstream-path: path/inside/repo
//     upstream-commit: <sha>
//
// Usage: npm run skills:upstream-diff [-- skill-name ...]
//        scripts/skills-upstream-diff.sh | scripts\skills-upstream-diff.cmd [skill-name ...]
// Output: a summary per skill, and a full diff in .skills-upstream/<skill>.diff
// Merge useful changes by hand, then bump upstream-commit in the frontmatter.
// Needs: Node.js >= 22, git
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, '.skills-upstream');
fs.mkdirSync(out, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-upstream-'));
process.on('exit', () => fs.rmSync(work, { recursive: true, force: true }));

const field = (text, key) =>
  (text.match(new RegExp(`^\\s*${key}:\\s*(.*)$`, 'm'))?.[1] ?? '').replace(/["']/g, '').trim();
const git = (dir, ...args) => spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

const args = process.argv.slice(2);
const skills = args.length > 0
  ? args
  : fs.readdirSync(path.join(root, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, 'skills', e.name, 'SKILL.md')))
    .map((e) => e.name)
    .sort();

for (const skill of skills) {
  const file = path.join(root, 'skills', skill, 'SKILL.md');
  if (!fs.existsSync(file)) { console.log(`!! ${skill}: no SKILL.md`); continue; }
  const text = fs.readFileSync(file, 'utf8');
  const repo = field(text, 'upstream-repo');
  const upath = field(text, 'upstream-path');
  const commit = field(text, 'upstream-commit');
  if (!repo) { console.log(`-- ${skill}: own skill, no upstream`); continue; }

  const dir = path.join(work, repo.replaceAll('/', '_'));
  if (!fs.existsSync(dir)) {
    const r = spawnSync('git', ['clone', '-q', '--filter=blob:none', `https://github.com/${repo}`, dir], { stdio: 'inherit' });
    if (r.status !== 0) process.exit(r.status ?? 1);
  }
  const head = git(dir, 'rev-parse', 'HEAD').stdout.trim();
  if (commit && head.startsWith(commit)) {
    console.log(`OK ${skill}: up to date with ${repo}@${head.slice(0, 10)}`);
    continue;
  }
  if (!commit || git(dir, 'cat-file', '-e', `${commit}^{commit}`).status !== 0) {
    console.log(`!! ${skill}: recorded commit ${commit} not found in ${repo}`);
    continue;
  }
  if (git(dir, 'diff', '--quiet', commit, 'HEAD', '--', upath).status === 0) {
    console.log(`OK ${skill}: ${repo} moved to ${head.slice(0, 10)}, no changes in ${upath}`);
    continue;
  }
  fs.writeFileSync(path.join(out, `${skill}.diff`), git(dir, 'diff', commit, 'HEAD', '--', upath).stdout);
  console.log(`>> ${skill}: upstream changed (${repo} ${commit.slice(0, 10)}..${head.slice(0, 10)})`);
  const stat = git(dir, 'diff', '--stat', commit, 'HEAD', '--', upath).stdout.trimEnd();
  console.log(stat.split('\n').map((l) => `   ${l}`).join('\n'));
  console.log(`   full diff: .skills-upstream/${skill}.diff (new upstream-commit: ${head})`);
}
