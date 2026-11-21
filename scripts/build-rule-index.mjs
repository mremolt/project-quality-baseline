#!/usr/bin/env node
// Builds docs/baseline/rule-index/: one compact file per scope (shared + each stack) that lists every
// rule ID with its one-sentence headline, grouped by doc. Agents read the index of the shared rules and
// of their stacks first, and open a full doc (or grep one rule ID in it) only when the task touches it.
// See docs/baseline/08-crosscutting-concepts/development/agent-skills.md#reading-the-docs-on-a-token-budget.
//
//   node scripts/build-rule-index.mjs           rewrite the index
//   node scripts/build-rule-index.mjs --check   exit 1 if the index is out of date (CI, before commit)
//   node scripts/build-rule-index.mjs --lint    report docs that break the token-budget rules (TOOL-SKL-10..13);
//                                               exit 1 on errors, warnings are advice (used by the baseline-doc-compactor agent)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs/baseline');
const outDir = path.join(docs, 'rule-index');
const stacksFile = JSON.parse(fs.readFileSync(path.join(root, 'baseline-stacks.json'), 'utf8'));
const STACKS = Object.keys(stacksFile.stacks);
const check = process.argv.includes('--check');
const lint = process.argv.includes('--lint');

const rel = (p) => path.relative(docs, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(p, 'utf8');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return ['stacks', 'rule-index', 'checklists'].includes(e.name) && dir === docs ? [] : walk(p);
    return e.name.endsWith('.md') && !(dir === docs && ['sources.md', 'retired-rule-ids.md'].includes(e.name)) ? [p] : [];
  });
}

// A doc belongs to a stack when a stack name is a dash-separated part of its file name (README "Conventions").
const stackOf = (file) => {
  const parts = path.basename(file, '.md').split('-');
  return STACKS.find((s) => parts.includes(s));
};

const RULE = /^\s*- \*\*([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+[a-z]?)\b(.*?)\*\*(.*)$/;
// Markdown to compact text: links become their text, emphasis marks go (outside code spans only).
const plain = (s) =>
  s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/\*\*|\*(?=\S)|(?<=\S)\*/g, '')))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
// First sentence of s: up to ". " (or "; " / ": " after 12 words) outside code spans (not after e.g./i.e./etc.), capped at max words.
const firstSentence = (s, max) => {
  const t = plain(s);
  let code = false;
  let end = t.length;
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '`') code = !code;
    if (code || !'.;:'.includes(t[i]) || (i + 1 < t.length && t[i + 1] !== ' ')) continue;
    if (/\b(e\.g|i\.e|etc|vs|incl|approx|cf)\.$/i.test(t.slice(Math.max(0, i - 5), i + 1))) continue;
    if (t[i] !== '.' && t.slice(0, i).split(' ').length < 12) continue; // keep short "…; see X-01" pointers whole
    end = i + 1;
    break;
  }
  const words = t.slice(0, end).split(' ');
  return words.length > max ? words.slice(0, max).join(' ') + ' …' : words.join(' ');
};

const ruleLog = [];
function rulesOf(file) {
  const out = [];
  let fence = false;
  for (const line of read(file).split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    if (fence) continue;
    const m = line.match(RULE);
    if (!m) continue;
    const [, id, boldRest, after] = m;
    // "**ID: headline.**", "**ID (default D2): headline.**", "**ID in Angular: headline.**" or "**ID:** text".
    const colon = boldRest.indexOf(':');
    const qualifier = plain(colon >= 0 ? boldRest.slice(0, colon) : boldRest);
    const headline = colon >= 0 ? plain(boldRest.slice(colon + 1)) : '';
    // A bold lead phrase without its own sentence end continues in the plain text after it.
    // "**Headline** (REF-01): details" — a colon, semicolon or full stop right after the bold part (and its
    // parenthetical references) ends the headline; the details after it stay in the doc.
    const complete = /[.!?:;]$/.test(headline);
    const closer = plain(after).match(/^((?:\((?:[^()]|\([^()]*\))*\)\s*)?)([.:;])(\s|$)/);
    const ref = closer?.[1].trim() ?? '';
    const text = complete
      ? headline
      : headline && closer
        ? `${headline}${ref && ref.split(' ').length <= 8 ? ' ' + ref : ''}${closer[2] === ':' ? ':' : '.'}`
        : firstSentence(`${headline}${/^[,;:.]/.test(after) ? '' : ' '}${after}`, Math.max(30, headline.split(' ').length + 15));
    out.push(`- ${id}${qualifier ? ' ' + qualifier : ''}: ${text}`);
    ruleLog.push({ file: rel(file), id, qualifier, idOnly: !headline && colon >= 0, cut: text.endsWith(' …') });
  }
  return out;
}

const title = (file) => (read(file).match(/^# (.+)$/m)?.[1] ?? path.basename(file, '.md')).trim();

const requiredBy = (s, seen = new Set()) => {
  for (const r of stacksFile.stacks[s]?.requires ?? []) if (!seen.has(r)) requiredBy(r, seen.add(r));
  return seen;
};

// Docs per scope: shared = every doc without a stack name; a stack = the stack-named docs its stack page links,
// except those already in the index of a stack it requires (the agent reads that index too, AGENTS.md "Read by stack").
const all = walk(docs).sort();
const scopes = { shared: all.filter((f) => !stackOf(f)) };
const linkedBy = (s) => {
  const page = path.join(docs, 'stacks', `${s}.md`);
  if (!fs.existsSync(page)) return null;
  const linked = [...read(page).matchAll(/\]\((\.\.\/[^)#\s]+\.md)/g)].map((m) => path.resolve(path.dirname(page), m[1]));
  return [...new Set(linked)].filter((f) => stackOf(f) && fs.existsSync(f)).sort();
};
const scopeOf = (s) => {
  if (s in scopes) return scopes[s];
  const own = linkedBy(s);
  if (!own) return (scopes[s] = null);
  const inherited = new Set([...requiredBy(s)].flatMap((r) => scopeOf(r) ?? []));
  return (scopes[s] = own.filter((f) => !inherited.has(f)));
};
STACKS.forEach(scopeOf);
for (const s of Object.keys(scopes)) if (!scopes[s]) delete scopes[s];

// Reading notes a stack page states for its readers and that the index has to carry along.
const NOTES = { react: 'A Next.js project skips rules and files marked (React SPA).' };

const HEADER = (scope) => `# Rule index: ${scope}

<!-- Generated by scripts/build-rule-index.mjs from the rule docs. Do not edit; change the doc and regenerate. -->

Every rule ID of ${scope === 'shared' ? 'the shared docs (all stacks)' : `the ${scope} docs`} with its headline, grouped by doc. The headline is the rule's first sentence; the full rule (details, values, examples, *Why*) is in the doc. **Before you implement against a rule, read its full text**: search the doc for the ID and read that bullet, or read the doc when the task is centred on its topic. MUST = deviation needs an ADR; SHOULD = default, deviate with a stated reason; no keyword = MUST unless it says *prefer*, *default* or *consider*.${NOTES[scope] ? ` ${NOTES[scope]}` : ''}
`;

const files = {};
for (const [scope, list] of Object.entries(scopes)) {
  const parts = [HEADER(scope)];
  for (const f of list) {
    const rules = rulesOf(f);
    if (!rules.length) continue;
    // A file-level "Scope: …" line (e.g. "Scope: React SPA.") applies to every rule of the file; keep it visible.
    const scope = read(f).match(/^Scope: ([^.\n]+)\./m)?.[1];
    parts.push(`\n## [${title(f)}](../${rel(f)})${scope ? ` (scope: ${plain(scope)})` : ''}\n\n${rules.join('\n')}\n`);
  }
  files[`${scope}.md`] = parts.join('');
}


if (lint) {
  const errors = [];
  const warnings = [];
  const seen = new Map();
  for (const r of ruleLog) {
    const key = `${r.file}|${r.id}`;
    if (seen.has(key)) continue;
    seen.set(key, r);
    if (r.cut) errors.push(`${r.file}: ${r.id}: index line is cut off; give it a self-contained bold headline of one sentence (TOOL-SKL-12)`);
    if (r.idOnly) warnings.push(`${r.file}: ${r.id}: no bold headline ("**${r.id}:** …"); the index shows the first sentence of the bullet (TOOL-SKL-12)`);
  }
  // A rule ID is defined once; "ID in <stack>" bullets map a shared rule and are allowed elsewhere.
  const defs = new Map();
  for (const r of seen.values()) if (!r.qualifier.startsWith('in ') && !/^and /.test(r.qualifier)) defs.set(r.id, [...(defs.get(r.id) ?? []), r.file]);
  for (const [id, where] of defs) if (where.length > 1) warnings.push(`${id}: defined in ${where.join(', ')}; define a rule once and reference its ID elsewhere`);

  // Checklists and sources live outside the docs, with one pointer line per doc (TOOL-SKL-13).
  const POINTER = /^\*Agent checklist in \[checklists\/([a-z]+)\.md\]\([^)]*\)( and sources in \[sources\.md\]\([^)]*\))?, section "(.+)"\.\*$|^\*Sources in \[sources\.md\]\([^)]*\), section "(.+)"\.\*$/m;
  const sectionsOf = (file) =>
    fs.existsSync(file) ? new Map([...read(file).matchAll(/^## (.+)\n\n\[([^\]]+)\]\(/gm)].map((m) => [m[1].trim(), m[2]])) : new Map();
  const checklistDir = path.join(docs, 'checklists');
  const checklistSections = new Map(
    (fs.existsSync(checklistDir) ? fs.readdirSync(checklistDir) : []).map((n) => [n.replace(/\.md$/, ''), sectionsOf(path.join(checklistDir, n))]),
  );
  const sourceSections = sectionsOf(path.join(docs, 'sources.md'));
  const pointed = { checklists: new Set(), sources: new Set() };
  for (const f of all) {
    const text = read(f);
    const r = rel(f);
    if (/^## Agent checklist\s*$/m.test(text)) errors.push(`${r}: has an "Agent checklist" section; move it to checklists/<scope>.md and leave the pointer line (TOOL-SKL-13)`);
    if (/^## Sources\s*$/m.test(text)) errors.push(`${r}: has a "Sources" section; move it to sources.md and leave the pointer line (TOOL-SKL-13)`);
    const m = text.match(POINTER);
    if (!m) continue;
    const t = title(f);
    const [, scope, withSources, section1, section2] = m;
    const section = section1 ?? section2;
    if (section !== t) errors.push(`${r}: pointer names section "${section}", but the doc title is "${t}"`);
    if (scope) {
      const expected = stackOf(f) ?? 'shared';
      if (scope !== expected) errors.push(`${r}: checklist pointer goes to checklists/${scope}.md, expected checklists/${expected}.md`);
      if (checklistSections.get(scope)?.get(t) !== r) errors.push(`${r}: checklists/${scope}.md has no section "${t}" linking to this doc`);
      pointed.checklists.add(r);
    }
    if (withSources || section2) {
      if (sourceSections.get(t) !== r) errors.push(`${r}: sources.md has no section "${t}" linking to this doc`);
      pointed.sources.add(r);
    }
  }
  for (const [scope, secs] of checklistSections) for (const [t, r] of secs) if (!pointed.checklists.has(r)) errors.push(`checklists/${scope}.md: section "${t}" links to ${r}, which has no pointer line to it`);
  for (const [t, r] of sourceSections) if (!pointed.sources.has(r)) errors.push(`sources.md: section "${t}" links to ${r}, which has no pointer line to it`);

  // Retired IDs (README "Conventions") are never defined again and no longer cited; references go to the replacement.
  const retiredFile = path.join(docs, 'retired-rule-ids.md');
  const retired = fs.existsSync(retiredFile) ? [...read(retiredFile).matchAll(/^\| ([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+[a-z]?) \|/gm)].map((m) => m[1]) : [];
  if (retired.length) {
    const cited = new RegExp(`\\b(${retired.join('|')})\\b`, 'g');
    const listFiles = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).filter((n) => n.endsWith('.md')).map((n) => path.join(d, n)) : []);
    const files = [
      ...listFiles(docs).filter((f) => f !== retiredFile && !f.includes(`${path.sep}rule-index${path.sep}`)),
      ...listFiles(path.join(root, 'skills')),
      ...listFiles(path.join(root, 'templates')),
      path.join(root, 'AGENTS.md'),
      path.join(root, 'ARCHITECTURE.md'),
    ].filter((f) => fs.existsSync(f));
    for (const f of files) {
      const hits = [...new Set([...read(f).matchAll(cited)].map((m) => m[1]))];
      if (hits.length) errors.push(`${path.relative(root, f)}: cites retired rule ID(s) ${hits.join(', ')}; use the replacement in retired-rule-ids.md`);
    }
  }

  // Reading instructions follow the steps of TOOL-SKL-10.
  const instructionFiles = [
    path.join(root, 'AGENTS.md'),
    ...fs.readdirSync(path.join(root, 'skills')).map((n) => path.join(root, 'skills', n, 'SKILL.md')),
    ...fs.readdirSync(path.join(root, '.claude', 'hooks')).map((n) => path.join(root, '.claude', 'hooks', n)),
  ].filter((f) => fs.existsSync(f));
  for (const f of instructionFiles) {
    if (/docs it lists|every doc (?:it|the stack page) lists/i.test(read(f).replace(/Never load every doc a stack page lists/g, '')))
      errors.push(`${path.relative(root, f)}: tells agents to read every doc a stack page lists; point to the rule index instead (TOOL-SKL-10)`);
  }

  for (const w of warnings) console.log(`warning: ${w}`);
  for (const e of errors) console.log(`error: ${e}`);
  console.log(`docs lint: ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length ? 1 : 0);
}

let stale = false;
if (!check) fs.mkdirSync(outDir, { recursive: true });
for (const [name, content] of Object.entries(files)) {
  const p = path.join(outDir, name);
  const old = fs.existsSync(p) ? read(p) : null;
  if (old === content) continue;
  stale = true;
  if (check) console.error(`rule index out of date: docs/baseline/rule-index/${name}`);
  else fs.writeFileSync(p, content);
}
for (const name of fs.existsSync(outDir) ? fs.readdirSync(outDir) : []) {
  if (files[name]) continue;
  stale = true;
  if (check) console.error(`rule index has a stale file: docs/baseline/rule-index/${name}`);
  else fs.rmSync(path.join(outDir, name));
}
if (check && stale) {
  console.error('Run: npm run docs:rule-index');
  process.exit(1);
}
if (!check) console.log(stale ? 'rule index updated' : 'rule index up to date');
