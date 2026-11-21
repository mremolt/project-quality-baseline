#!/usr/bin/env node
// Copies the quality baseline into a consuming project. What it creates, replaces and never touches:
// docs/baseline/08-crosscutting-concepts/development/agent-skills.md#distribution-to-consuming-projects (the one list).
//
// Usage (Linux/macOS/Git Bash): scripts/sync-baseline.sh <project-dir> [--force] [--host <host>]
//       (Windows CMD/PowerShell): scripts\sync-baseline.cmd <project-dir> [--force] [--host <host>]
//   --force         run even if the project has uncommitted changes
//   --host <host>   where the project's pull requests live: github | gitlab | azure | bitbucket
//                   (default: detected from the git remote 'origin'); decides where the PR template goes
// Needs: Node.js (version in package.json "engines.node") and git.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = readJson(path.join(base, 'package.json'));
const skillsCli = `skills@${pkg.devDependencies?.skills ?? 'latest'}`;
checkNodeVersion(pkg.engines?.node);

// Where each host reads its pull request template from. Bitbucket reads none from the repository:
// the file is created as a draft and pasted into the repository's default description by hand.
const PR_TEMPLATE = {
  github: '.github/pull_request_template.md',
  gitlab: '.gitlab/merge_request_templates/Default.md',
  azure: '.azuredevops/pull_request_template.md',
  bitbucket: 'docs/pull-request-template.md',
};
const USAGE = `usage: sync-baseline <project-dir> [--force] [--host ${Object.keys(PR_TEMPLATE).join('|')}]`;

const opts = parseArgs(process.argv.slice(2));
if (!opts.target) fail(USAGE);
if (!isDir(opts.target)) fail(`not a directory: ${opts.target}`);
const target = fs.realpathSync(opts.target);
if (target === fs.realpathSync(base)) fail('target is the baseline itself');

// The uncommitted-changes check only makes sense against a commit: a project without git or without a first
// commit has nothing to diff against, so the sync runs and its result is reviewed with `git status`.
const isRepo = git(target, 'rev-parse').ok;
const hasCommit = isRepo && git(target, 'rev-parse', '--verify', '-q', 'HEAD').ok;
if (hasCommit && git(target, 'status', '--porcelain').out && !opts.force) {
  fail('Project has uncommitted changes. Commit or stash first (or pass --force), so the sync is a reviewable diff.');
}

// Managed blocks must be intact before anything is written: a start marker without an end marker
// would silently drop everything after it (the project notes in AGENTS.md).
const AGENTS_MARKERS = ['<!-- baseline:start', '<!-- baseline:end -->'];
const ATTR_MARKERS = ['# baseline:start', '# baseline:end'];
checkMarkers(path.join(target, 'AGENTS.md'), AGENTS_MARKERS);
checkMarkers(path.join(target, '.gitattributes'), ATTR_MARKERS);

// The rule index is what agents read first (TOOL-SKL-10); a stale one would hide changed rules.
const ruleIndex = spawnSync(process.execPath, [path.join(base, 'scripts', 'build-rule-index.mjs'), '--check'], { encoding: 'utf8' });
if (ruleIndex.status !== 0) fail(`${ruleIndex.stderr}The rule index is out of date. Run \`npm run docs:rule-index\` in the baseline repository first (TOOL-SKL-11).`);

const host = opts.host ?? detectHost(target);

// Declared stacks (.baseline.json, project-owned): only their skills are copied and only their AGENTS.md lines kept.
const stackDefs = readJson(path.join(base, 'baseline-stacks.json'));
const stacks = resolveStacks(target, stackDefs);

const log = (msg) => console.log(`  - ${msg}`);
const rev = git(base, 'rev-parse', '--short', 'HEAD');
console.log(`Syncing baseline ${rev.ok ? rev.out : '(uncommitted)'} into ${target}`);
log(stacks.declared
  ? `stacks: ${[...stacks.active].join(' ')} (from .baseline.json)`
  : 'MANUAL: no .baseline.json and no stack detected: all stacks are synced. Create .baseline.json, e.g. {"stacks": ["spring", "angular"]}, and re-run');
if (stacks.created) log(`.baseline.json created from the detected stacks (${stacks.created.join(', ')}); check it`);
if (!isRepo) log('MANUAL: the project is not a git repository; run `git init` and add the remote, then re-run so the pull request template is created');
else if (!hasCommit) log('the project has no commits yet: uncommitted-changes check skipped');

// ---------------------------------------------------------------- docs
// docs/baseline is baseline-owned and replaced as a whole (arc42 reference architecture).
const baselineDocs = path.join(target, 'docs', 'baseline');
fs.rmSync(baselineDocs, { recursive: true, force: true });
fs.cpSync(path.join(base, 'docs', 'baseline'), baselineDocs, { recursive: true });
log('docs/baseline');

// Layout before the arc42 restructuring: only the files the baseline shipped there are removed.
// Anything else in these folders belongs to the project and stays; the folder is then left for a manual decision.
const LEGACY_DOCS = {
  angular: ['README.md', 'architecture.md', 'state-management.md', 'testing.md', 'tooling.md', 'ui-material.md'],
  java: ['architecture.md'],
  shared: ['README.md', 'accessibility/wcag.md', 'api/avoiding-n-plus-one.md', 'api/openapi-contracts.md',
    'architecture/adapters.md', 'architecture/code-organization.md', 'architecture/conscious-shortcuts.md',
    'architecture/enforcing-boundaries.md', 'architecture/hexagonal-architecture.md',
    'architecture/mapping-between-boundaries.md', 'architecture/use-cases.md', 'repository/repository-layout.md',
    'testing/tdd.md', 'testing/testing-by-architecture-element.md', 'tooling/agent-skills.md', 'tooling/ide-setup.md'],
  spring: ['architecture.md', 'openapi.md'],
  typescript: ['README.md', 'frontend-architecture.md', 'openapi-clients.md', 'testing.md', 'tooling.md'],
};
for (const [d, files] of Object.entries(LEGACY_DOCS)) {
  const legacy = path.join(target, 'docs', d);
  if (!isDir(legacy)) continue;
  let removed = 0;
  for (const f of files) {
    const file = path.join(legacy, ...f.split('/'));
    if (fs.existsSync(file)) { fs.rmSync(file, { force: true }); removed += 1; }
  }
  if (removed === 0) continue;
  removeEmptyDirs(legacy);
  if (isDir(legacy)) {
    log(`MANUAL: removed ${removed} legacy baseline file(s) from docs/${d} (now in docs/baseline); the files left there are not from the baseline: move or delete them`);
  } else {
    log(`removed legacy docs/${d} (now in docs/baseline)`);
  }
}

// docs/architecture is project-owned: created once from the arc42 template, never touched afterwards.
const architecture = path.join(target, 'docs', 'architecture');
if (!fs.existsSync(architecture)) {
  fs.cpSync(path.join(base, 'templates', 'arc42'), architecture, { recursive: true });
  log('docs/architecture created from the arc42 template (fill it in; DOC-ARC-01)');
}

// Artefacts the rules require, project-owned: each is created once from its template, never overwritten.
const projectFiles = [
  ['adr/0000-template.md', 'docs/adr/0000-template.md', 'copy it per decision; ARCH-SC-03'],
  ['security/requirements.md', 'docs/security/requirements.md', 'fill in ASVS level and data classification; SEC-REQ-01'],
  ['security/threat-model.md', 'docs/security/threat-model.md', 'SEC-TM-01'],
  ['security/exceptions.md', 'docs/security/exceptions.md', 'SEC-VUL-03'],
  ['security/incident-runbook.md', 'docs/security/incident-runbook.md', 'fill in contacts and rotation steps; SEC-INC-02'],
  ['SECURITY.md', 'SECURITY.md', 'fill in the reporting address; SEC-INC-02'],
  ['data-protection/processing-record.md', 'docs/data-protection/processing-record.md', 'fill in with the DPO; DP-INV-01'],
  ['data-protection/deletion-concept.md', 'docs/data-protection/deletion-concept.md', 'fill in with the DPO; DP-INV-02'],
];
if (host) {
  const note = host === 'bitbucket'
    ? 'Bitbucket reads no template file: paste it into the repository\'s default pull request description; SEC-REV-01, API-N1-02'
    : `${host}; SEC-REV-01, API-N1-02`;
  projectFiles.push(['pull-request/pull_request_template.md', PR_TEMPLATE[host], note]);
} else {
  log(`MANUAL: pull request template not created: the host could not be detected from the git remote. Re-run with --host ${Object.keys(PR_TEMPLATE).join('|')}`);
}
// security.txt is served with the SPA, so it goes into the frontend's static folder (if there is a frontend).
// Other web apps copy it from templates/well-known/ into their static folder (SEC-INC-02).
if (isDir(path.join(target, 'frontend'))) {
  projectFiles.push(['well-known/security.txt', 'frontend/public/.well-known/security.txt', 'fill in Contact and Expires; SEC-INC-02']);
}
for (const [from, to, note] of projectFiles) {
  const dest = path.join(target, ...to.split('/'));
  if (fs.existsSync(dest)) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(path.join(base, 'templates', ...from.split('/')), dest);
  log(`${to} created from the template (${note})`);
}

// ---------------------------------------------------------------- AGENTS.md (managed block)
const block = filterStackLines(extractBlock(read(path.join(base, 'AGENTS.md')), ...AGENTS_MARKERS), stacks);
const agents = path.join(target, 'AGENTS.md');
if (!fs.existsSync(agents)) {
  write(agents, `${block}\n`);
  log('AGENTS.md created');
} else if (read(agents).includes(AGENTS_MARKERS[0])) {
  write(agents, replaceBlock(read(agents), block, ...AGENTS_MARKERS));
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
const attrBlock = extractBlock(read(path.join(base, '.gitattributes')), ...ATTR_MARKERS);
if (!fs.existsSync(attrs)) {
  write(attrs, `${attrBlock}\n`);
  log('.gitattributes created');
} else if (read(attrs).includes(ATTR_MARKERS[0])) {
  write(attrs, replaceBlock(read(attrs), attrBlock, ...ATTR_MARKERS));
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
])].sort().filter((n) => stacks.wantsSkill(n));

for (const n of old) {
  if (!names.includes(n)) {
    fs.rmSync(path.join(agentSkills, n), { recursive: true, force: true });
    fs.rmSync(path.join(claudeSkills, n), { recursive: true, force: true });
    log(`removed skill ${n} (no longer in the baseline, or only used by stacks the project does not declare)`);
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

// lock file: baseline entries win; local-path entries (our own skills) and skills of undeclared stacks are not carried over
const baseLock = readJson(path.join(base, 'skills-lock.json'));
const baseLockNames = Object.keys(baseLock.skills ?? {});
baseLock.skills = Object.fromEntries(Object.entries(baseLock.skills ?? {})
  .filter(([n, v]) => v.sourceType !== 'local' && names.includes(n)));
const lockFile = path.join(target, 'skills-lock.json');
const lock = fs.existsSync(lockFile) ? deepMerge(readJson(lockFile), baseLock) : baseLock;
// Baseline skills of undeclared stacks leave the lock file unless the project installed them itself (folder present).
for (const n of baseLockNames) {
  if (!names.includes(n) && lock.skills && n in lock.skills && !fs.existsSync(path.join(agentSkills, n))) {
    delete lock.skills[n];
    log(`skills-lock.json: removed entry ${n} (stack not declared)`);
  }
}
// Skills the baseline dropped (removed above) leave the lock file too; the project's own entries stay.
for (const n of old) {
  if (!names.includes(n) && lock.skills && n in lock.skills) {
    delete lock.skills[n];
    log(`skills-lock.json: removed entry ${n}`);
  }
}
writeJson(lockFile, lock);
log('skills-lock.json merged');

// ---------------------------------------------------------------- Claude Code hooks
// Baseline hooks are files named baseline-* in .claude/hooks. Their settings entries are owned by the
// baseline: old ones (any command pointing at .claude/hooks/baseline-) are dropped, and the current ones of
// the hooks the project gets (shared, or owned by a declared stack in baseline-stacks.json) are added.
const hooksDir = path.join(target, '.claude', 'hooks');
fs.mkdirSync(hooksDir, { recursive: true });
for (const e of entries(hooksDir)) {
  if (e.name.startsWith('baseline-')) fs.rmSync(path.join(hooksDir, e.name), { force: true });
}
const hookNames = entries(path.join(base, '.claude', 'hooks'))
  .filter((e) => e.isFile() && e.name.startsWith('baseline-') && stacks.wantsHook(e.name))
  .map((e) => e.name)
  .sort();
for (const n of hookNames) fs.copyFileSync(path.join(base, '.claude', 'hooks', n), path.join(hooksDir, n));
log(`hooks: ${hookNames.join(' ') || '(none)'}`);
const settingsFile = path.join(target, '.claude', 'settings.json');
if (!fs.existsSync(settingsFile)) write(settingsFile, '{}\n');
let settings;
try { settings = JSON.parse(read(settingsFile)); } catch { settings = undefined; }
if (settings && typeof settings === 'object') {
  const BASELINE_HOOK = /\.claude\/hooks\/(baseline-[^"'\s/\\]+)/;
  const hookFile = (h) => (typeof h?.command === 'string' ? BASELINE_HOOK.exec(h.command)?.[1] : undefined);
  const baseHooks = readJson(path.join(base, '.claude', 'settings.json')).hooks ?? {};
  const hooks = settings.hooks ?? {};
  for (const event of Object.keys(hooks)) {
    hooks[event] = hooks[event]
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((h) => !hookFile(h)) }))
      .filter((group) => group.hooks.length > 0);
    if (hooks[event].length === 0) delete hooks[event];
  }
  for (const [event, groups] of Object.entries(baseHooks)) {
    const wanted = groups
      .map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((h) => !hookFile(h) || hookNames.includes(hookFile(h))) }))
      .filter((group) => group.hooks.length > 0);
    if (wanted.length > 0) hooks[event] = [...(hooks[event] ?? []), ...wanted];
  }
  if (Object.keys(hooks).length > 0) settings.hooks = hooks;
  else delete settings.hooks;
  writeJson(settingsFile, settings);
  log('.claude/settings.json hooks merged');
} else {
  log("MANUAL: .claude/settings.json is not plain JSON; add the hooks from the baseline's .claude/settings.json by hand");
}

console.log(`
Done. Review with: git -C "${target}" status   (new files are untracked, so \`git diff\` alone misses them)
Next steps in the project:
  - Fill in the files created from templates above (SECURITY.md, docs/security/requirements.md, security.txt, …)
  - IDE config: run the baseline-ide-setup skill (or .agents/skills/baseline-ide-setup/scripts/apply-ide-config.sh / .cmd)
  - Check skills without changing them: npx ${skillsCli} check`);

// ---------------------------------------------------------------- helpers
// The project's stacks plus the stacks they require. Without .baseline.json the stacks are detected from the
// component folders and written to a new .baseline.json; if nothing is detected, every stack is active.
function resolveStacks(dir, defs) {
  const known = Object.keys(defs.stacks);
  const file = path.join(dir, '.baseline.json');
  let wanted;
  let created;
  if (fs.existsSync(file)) {
    let cfg;
    try { cfg = readJson(file); } catch { fail('.baseline.json is not valid JSON'); }
    wanted = cfg.stacks;
    if (!Array.isArray(wanted) || wanted.length === 0) fail(`.baseline.json needs "stacks": a non-empty list of ${known.join(', ')}`);
    const unknown = wanted.filter((s) => !known.includes(s));
    if (unknown.length > 0) fail(`.baseline.json: unknown stack(s) ${unknown.join(', ')}; known: ${known.join(', ')}`);
  } else {
    wanted = known.filter((s) => defs.stacks[s].detect.some((d) => detectFile(dir, d)));
    if (wanted.length > 0) {
      writeJson(file, { stacks: wanted });
      created = wanted;
    }
  }
  const declared = wanted.length > 0;
  const active = new Set();
  const add = (s) => { if (!active.has(s)) { active.add(s); defs.stacks[s].requires.forEach(add); } };
  (declared ? wanted : known).forEach(add);
  const ownersOf = (key) => {
    const owner = new Map();
    for (const [s, def] of Object.entries(defs.stacks)) for (const k of def[key] ?? []) owner.set(k, [...(owner.get(k) ?? []), s]);
    return owner;
  };
  const skillOwner = ownersOf('skills');
  const hookOwner = ownersOf('hooks');
  return {
    declared,
    created,
    active,
    // Shared skills and skills no stack claims are always copied; baseline-only skills never.
    wantsSkill: (n) => !(defs.baselineOnly ?? []).includes(n)
      && (defs.shared.includes(n) || !skillOwner.has(n) || skillOwner.get(n).some((s) => active.has(s))),
    // Hooks no stack claims are always copied.
    wantsHook: (n) => !hookOwner.has(n) || hookOwner.get(n).some((s) => active.has(s)),
  };
}

// "<folder-glob>/<file>[#<text>]": a top-level folder matching the glob (only a trailing * is supported)
// contains the file, and the file contains the text.
function detectFile(dir, spec) {
  const [rel, text] = spec.split('#');
  const [folderGlob, ...rest] = rel.split('/');
  const prefix = folderGlob.replace(/\*$/, '');
  return entries(dir)
    .filter((e) => e.isDirectory() && (folderGlob.endsWith('*') ? e.name.startsWith(prefix) : e.name === folderGlob))
    .some((e) => {
      const f = path.join(dir, e.name, ...rest);
      return fs.existsSync(f) && (!text || read(f).includes(text));
    });
}

// Lines tagged <!-- stack:a,b --> stay only if one of the stacks is active; the tag itself is removed.
function filterStackLines(text, stacks) {
  const tag = /\s*<!-- stack:([a-z0-9,-]+) -->/;
  return text.split('\n')
    .filter((l) => { const m = tag.exec(l); return !m || m[1].split(',').some((s) => stacks.active.has(s)); })
    .map((l) => l.replace(tag, ''))
    .join('\n');
}

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

function removeEmptyDirs(d) {
  for (const e of entries(d)) if (e.isDirectory()) removeEmptyDirs(path.join(d, e.name));
  if (entries(d).length === 0) fs.rmSync(d, { recursive: true, force: true });
}

// Flags by name, in any order: <project-dir> [--force] [--host <host> | --host=<host>].
function parseArgs(args) {
  const out = { target: undefined, force: false, host: undefined };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--force') out.force = true;
    else if (a === '--host' || a.startsWith('--host=')) {
      const v = a === '--host' ? args[(i += 1)] : a.slice('--host='.length);
      if (!v || !(v in PR_TEMPLATE)) fail(`--host must be one of ${Object.keys(PR_TEMPLATE).join(', ')}\n${USAGE}`);
      out.host = v;
    } else if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
    else if (a.startsWith('-')) fail(`unknown option: ${a}\n${USAGE}`);
    else if (out.target) fail(`more than one project directory given\n${USAGE}`);
    else out.target = a;
  }
  return out;
}

// The pull request host from the 'origin' remote URL; undefined if there is no remote or the host is unknown.
function detectHost(dir) {
  const url = git(dir, 'remote', 'get-url', 'origin');
  if (!url.ok) return undefined;
  const u = url.out.toLowerCase();
  if (u.includes('github')) return 'github';
  if (u.includes('gitlab')) return 'gitlab';
  if (u.includes('dev.azure.com') || u.includes('visualstudio.com')) return 'azure';
  if (u.includes('bitbucket')) return 'bitbucket';
  return undefined;
}

function checkMarkers(file, [start, end]) {
  if (!fs.existsSync(file)) return;
  const lines = read(file).split(/\r?\n/);
  const from = lines.findIndex((l) => l.includes(start));
  if (from < 0) return;
  if (!lines.some((l, i) => i > from && l.includes(end))) {
    fail(`${path.basename(file)} has the start marker '${start}' but no end marker '${end}' after it. Add the end marker after the baseline block, then re-run (nothing was changed).`);
  }
}

// Fails unless the running Node satisfies a ">=X.Y[.Z]" range (the only form package.json uses).
function checkNodeVersion(range) {
  const want = /^>=\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(range ?? '');
  if (!want) return;
  const have = process.versions.node.split('.').map(Number);
  const need = want.slice(1).map((v) => Number(v ?? 0));
  for (let i = 0; i < 3; i += 1) {
    if (have[i] > need[i]) return;
    if (have[i] < need[i]) fail(`Node.js ${range} required (package.json engines.node), found ${process.versions.node}`);
  }
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
