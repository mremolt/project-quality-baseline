#!/usr/bin/env node
// Copies the quality baseline into a consuming project (docs/shared/tooling/agent-skills.md).
// Only baseline-owned paths are touched; project files (docs/adr, own skills, project notes
// below the AGENTS.md end marker) are kept.
//
// Usage (Linux/macOS/Git Bash): scripts/sync-baseline.sh <project-dir> [--force]
//       (Windows CMD/PowerShell): scripts\sync-baseline.cmd <project-dir> [--force]
//   --force   run even if the project has uncommitted changes
// Needs: Node.js >= 22, git
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [targetArg, force] = process.argv.slice(2);
if (!targetArg) fail('usage: sync-baseline <project-dir> [--force]');
if (!isDir(targetArg)) fail(`not a directory: ${targetArg}`);
const target = fs.realpathSync(targetArg);
if (target === fs.realpathSync(base)) fail('target is the baseline itself');

if (git(target, 'rev-parse').ok && git(target, 'status', '--porcelain').out && force !== '--force') {
  fail('Project has uncommitted changes. Commit or stash first (or pass --force), so the sync is a reviewable diff.');
}

const log = (msg) => console.log(`  - ${msg}`);
const rev = git(base, 'rev-parse', '--short', 'HEAD');
console.log(`Syncing baseline ${rev.ok ? rev.out : '(uncommitted)'} into ${target}`);

// ---------------------------------------------------------------- docs
for (const d of ['shared', 'java', 'spring', 'typescript', 'angular']) {
  const dest = path.join(target, 'docs', d);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(path.join(base, 'docs', d), dest, { recursive: true });
  log(`docs/${d}`);
}

// ---------------------------------------------------------------- AGENTS.md (managed block)
const block = extractBlock(read(path.join(base, 'AGENTS.md')), '<!-- baseline:start', '<!-- baseline:end -->');
const agents = path.join(target, 'AGENTS.md');
if (!fs.existsSync(agents)) {
  write(agents, `${block}\n`);
  log('AGENTS.md created');
} else if (read(agents).includes('<!-- baseline:start')) {
  write(agents, replaceBlock(read(agents), block, '<!-- baseline:start', '<!-- baseline:end -->'));
  log('AGENTS.md baseline block replaced');
} else {
  write(agents, `${block}\n\n${read(agents)}`);
  log('AGENTS.md: baseline block prepended (check for duplicated instructions below it)');
}

// ---------------------------------------------------------------- CLAUDE.md
const claude = path.join(target, 'CLAUDE.md');
if (!fs.existsSync(claude)) {
  write(claude, '@AGENTS.md\n');
  log('CLAUDE.md created');
} else if (!/^@AGENTS\.md/m.test(read(claude))) {
  log("MANUAL: CLAUDE.md exists without '@AGENTS.md'; add that line so Claude Code reads the baseline");
}

// ---------------------------------------------------------------- .gitattributes (managed block)
// Keeps launcher line endings intact for every developer: .sh needs LF (bash), .cmd needs CRLF (CMD).
const attrs = path.join(target, '.gitattributes');
const attrBlock = extractBlock(read(path.join(base, '.gitattributes')), '# baseline:start', '# baseline:end');
if (!fs.existsSync(attrs)) {
  write(attrs, `${attrBlock}\n`);
  log('.gitattributes created');
} else if (read(attrs).includes('# baseline:start')) {
  write(attrs, replaceBlock(read(attrs), attrBlock, '# baseline:start', '# baseline:end'));
  log('.gitattributes baseline block replaced');
} else {
  const current = read(attrs);
  write(attrs, `${current}${current.endsWith('\n') || !current ? '' : '\n'}\n${attrBlock}\n`);
  log('.gitattributes: baseline block appended');
}

// ---------------------------------------------------------------- skills
const agentSkills = path.join(target, '.agents', 'skills');
const claudeSkills = path.join(target, '.claude', 'skills');
fs.mkdirSync(agentSkills, { recursive: true });
fs.mkdirSync(claudeSkills, { recursive: true });
const manifest = path.join(agentSkills, '.baseline-skills');
const old = fs.existsSync(manifest) ? read(manifest).split(/\r?\n/).filter(Boolean) : [];

const names = [...new Set([
  ...entries(path.join(base, '.agents', 'skills')).filter((e) => e.isDirectory() || e.isSymbolicLink()).map((e) => e.name),
  ...entries(path.join(base, 'skills')).filter((e) => e.isDirectory()).map((e) => e.name),
])].sort();

for (const n of old) {
  if (!names.includes(n)) {
    fs.rmSync(path.join(agentSkills, n), { recursive: true, force: true });
    fs.rmSync(path.join(claudeSkills, n), { recursive: true, force: true });
    log(`removed skill ${n} (no longer in the baseline)`);
  }
}
let junctions = false;
for (const n of names) {
  const src = isDir(path.join(base, 'skills', n)) ? path.join(base, 'skills', n) : path.join(base, '.agents', 'skills', n);
  const dest = path.join(agentSkills, n);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true, dereference: true });
  junctions = linkDir(path.join('..', '..', '.agents', 'skills', n), path.join(claudeSkills, n)) || junctions;
}
write(manifest, `${names.join('\n')}\n`);
log(`skills: ${names.join(' ')}`);
if (junctions) {
  log('MANUAL: Windows refused relative symlinks, so .claude/skills/* are junctions (absolute, not committable).'
    + ' Enable Developer Mode and `git config core.symlinks true`, then re-run, before committing .claude/skills');
}

// lock file: baseline entries win; local-path entries (our own skills) are not carried over
const baseLock = readJson(path.join(base, 'skills-lock.json'));
baseLock.skills = Object.fromEntries(Object.entries(baseLock.skills ?? {}).filter(([, v]) => v.sourceType !== 'local'));
const lockFile = path.join(target, 'skills-lock.json');
writeJson(lockFile, fs.existsSync(lockFile) ? deepMerge(readJson(lockFile), baseLock) : baseLock);
log('skills-lock.json merged');

// ---------------------------------------------------------------- Claude Code hooks
// Baseline hooks are files named baseline-* in .claude/hooks. Their settings entries are owned by the
// baseline: old ones (any command pointing at .claude/hooks/baseline-) are dropped, current ones added.
const hooksDir = path.join(target, '.claude', 'hooks');
fs.mkdirSync(hooksDir, { recursive: true });
for (const e of entries(hooksDir)) {
  if (e.name.startsWith('baseline-')) fs.rmSync(path.join(hooksDir, e.name), { force: true });
}
for (const e of entries(path.join(base, '.claude', 'hooks'))) {
  if (e.name.startsWith('baseline-')) fs.copyFileSync(path.join(base, '.claude', 'hooks', e.name), path.join(hooksDir, e.name));
}
const settingsFile = path.join(target, '.claude', 'settings.json');
if (!fs.existsSync(settingsFile)) write(settingsFile, '{}\n');
let settings;
try { settings = JSON.parse(read(settingsFile)); } catch { settings = undefined; }
if (settings && typeof settings === 'object') {
  const isBaseline = (h) => typeof h?.command === 'string' && h.command.includes('.claude/hooks/baseline-');
  const baseHooks = readJson(path.join(base, '.claude', 'settings.json')).hooks ?? {};
  const hooks = settings.hooks ?? {};
  for (const event of Object.keys(hooks)) {
    hooks[event] = hooks[event]
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((h) => !isBaseline(h)) }))
      .filter((group) => group.hooks.length > 0);
    if (hooks[event].length === 0) delete hooks[event];
  }
  for (const [event, groups] of Object.entries(baseHooks)) hooks[event] = [...(hooks[event] ?? []), ...groups];
  settings.hooks = hooks;
  writeJson(settingsFile, settings);
  log('.claude/settings.json hooks merged');
} else {
  log("MANUAL: .claude/settings.json is not plain JSON; add the hooks from the baseline's .claude/settings.json by hand");
}

console.log(`
Done. Review with: git -C "${target}" diff --stat
Next steps in the project:
  - IDE config: run the baseline-ide-setup skill (or .agents/skills/baseline-ide-setup/scripts/apply-ide-config.sh / .cmd)
  - Check skills without changing them: npx skills@1.9.0 check`);

// ---------------------------------------------------------------- helpers
function fail(msg) { console.error(msg); process.exit(1); }
function read(f) { return fs.readFileSync(f, 'utf8'); }
function write(f, s) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, s); }
function readJson(f) { return JSON.parse(read(f)); }
function writeJson(f, v) { write(f, `${JSON.stringify(v, null, 2)}\n`); }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function entries(d) { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } }

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim() };
}

// Lines from the start marker line through the end marker line (like sed -n '/start/,/end/p').
function extractBlock(text, start, end) {
  const lines = text.split(/\r?\n/);
  const from = lines.findIndex((l) => l.includes(start));
  if (from < 0) return '';
  const to = lines.findIndex((l, i) => i > from && l.includes(end));
  return lines.slice(from, to < 0 ? undefined : to + 1).join('\n');
}

function replaceBlock(text, block, start, end) {
  const out = [];
  let skip = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.includes(start)) { out.push(block); skip = true; continue; }
    if (line.includes(end)) { skip = false; continue; }
    if (!skip) out.push(line);
  }
  return out.join('\n');
}

// jq's `a * b`: objects merge recursively, everything else from b wins.
function deepMerge(a, b) {
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(a) || !isObj(b)) return b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? deepMerge(out[k], v) : v;
  return out;
}

// Relative directory symlink; on Windows without symlink rights, falls back to a junction. Returns true for a junction.
function linkDir(relTarget, linkPath) {
  fs.rmSync(linkPath, { recursive: true, force: true });
  try {
    fs.symlinkSync(relTarget, linkPath, 'dir');
    return false;
  } catch (e) {
    if (process.platform !== 'win32') throw e;
    fs.symlinkSync(path.resolve(path.dirname(linkPath), relTarget), linkPath, 'junction');
    return true;
  }
}
