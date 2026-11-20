#!/usr/bin/env node
// Applies the baseline IDE configuration (VS Code + IntelliJ IDEA Ultimate) to a project.
// Detects the stack, then creates or merges config files. Existing user settings are kept;
// baseline keys win where they overlap. Files that can't be merged safely are written next
// to the original as *.baseline.* and reported.
//
// Usage (Linux/macOS/Git Bash): apply-ide-config.sh [project-dir]     (default: current directory)
//       (Windows CMD/PowerShell): apply-ide-config.cmd [project-dir]
// Needs: Node.js >= 22
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tpl = path.join(skillDir, 'templates');
process.chdir(path.resolve(process.argv[2] ?? '.'));

const report = [];
const note = (msg) => report.push(msg);
const tplPath = (name) => path.join(tpl, name);

// ---------------------------------------------------------------- detection
// Components: the root itself or first-level folders (product repo with backend/, frontend/, REPO-LAY-03).
// A TypeScript component has a package.json plus a tsconfig.json or a typescript dependency.
const firstLevel = fs.readdirSync('.', { withFileTypes: true })
  .filter((e) => !e.name.startsWith('.') && isDir(e.name))
  .map((e) => e.name)
  .sort();
const components = ['.', ...firstLevel];

const pkgHas = (d, dep) => {
  const pkg = readJsonSafe(path.join(d, 'package.json'));
  return !!pkg && dep in { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
};
const tsDirs = components.filter((d) => d !== 'node_modules' && isFile(path.join(d, 'package.json'))
  && (isFile(path.join(d, 'tsconfig.json')) || pkgHas(d, 'typescript')));
const hasDep = (dep) => tsDirs.some((d) => pkgHas(d, dep));
const buildFiles = components.flatMap((d) => (d === '.' ? fs.readdirSync('.') : safeReaddir(d)).map((f) => path.join(d, f)))
  .filter((f) => isFile(f) && /^(pom\.xml|build\.gradle.*)$/.test(path.basename(f)));
const buildHas = (s) => buildFiles.some((f) => read(f).includes(s));
// a file or folder with a matching name in the root or a first-level folder
const anyExists = (re) => components.some((d) => (d === '.' ? fs.readdirSync('.') : safeReaddir(d)).some((f) => re.test(f)));

const ts = tsDirs.length > 0;
const angular = hasDep('@angular/core');
const nestjs = hasDep('@nestjs/core');
const react = hasDep('react');
const nextjs = hasDep('next');
const vitest = hasDep('vitest');
const playwright = hasDep('@playwright/test');
const java = buildFiles.length > 0;
const spring = java && buildHas('spring-boot');
const openapi = anyExists(/^openapi$/) || hasDep('orval') || hasDep('@nestjs/swagger') || buildHas('springdoc');
const docker = anyExists(/^(Dockerfile|compose\.y.*ml|docker-compose\.y.*ml)$/);
let jformat = 'none';
if (java && buildHas('spotless')) {
  if (buildHas('palantirJavaFormat') || buildHas('palantir-java-format')) jformat = 'palantir';
  else if (buildHas('googleJavaFormat') || buildHas('google-java-format')) jformat = 'google';
  else if (buildHas('eclipse')) jformat = 'eclipse';
}

console.log(`TypeScript components: ${tsDirs.join(' ') || 'none'}`);
console.log(`Detected: ts=${ts} angular=${angular} react=${react} nextjs=${nextjs} nestjs=${nestjs} vitest=${vitest} playwright=${playwright} java=${java} spring=${spring} openapi=${openapi} docker=${docker} java-formatter=${jformat}`);

// ---------------------------------------------------------------- .editorconfig
if (!fs.existsSync('.editorconfig')) {
  fs.copyFileSync(tplPath('editorconfig'), '.editorconfig');
  note('created .editorconfig');
} else {
  note(`kept existing .editorconfig (compare with ${tplPath('editorconfig')})`);
}

// ---------------------------------------------------------------- VS Code settings
fs.mkdirSync('.vscode', { recursive: true });
let desired = readJson(tplPath('vscode-settings.base.json'));
if (!ts) {
  for (const k of ['typescript.tsdk', 'typescript.enablePromptUseWorkspaceTsdk', 'eslint.validate', 'eslint.workingDirectories']) delete desired[k];
}
if (ts && tsDirs[0] !== '.') desired['typescript.tsdk'] = `${tsDirs[0]}/node_modules/typescript/lib`;
if (tsDirs.length > 1) {
  note(`MANUAL: several TypeScript components (${tsDirs.join(' ')}); typescript.tsdk points to ${tsDirs[0]}. Keep their TypeScript versions aligned or pick the main one`);
}
if (angular) desired = deepMerge(desired, readJson(tplPath('vscode-settings.angular.json')));
if (java) desired = deepMerge(desired, readJson(tplPath('vscode-settings.java.json')));
if (jformat === 'google' || jformat === 'palantir') {
  note(`Java (${jformat}-java-format): VS Code has no maintained integration; Java format-on-save stays off there, format with the build's spotless apply task`);
}
if (jformat === 'eclipse') {
  note('Java: Eclipse formatter via Spotless detected; set java.format.settings.url in .vscode/settings.json to the formatter XML and enable [java] formatOnSave');
}

const vsSettings = path.join('.vscode', 'settings.json');
if (fs.existsSync(vsSettings)) {
  const current = readJsonSafe(vsSettings);
  if (current !== undefined) {
    writeJson(vsSettings, deepMerge(current, desired));
    note('merged .vscode/settings.json');
  } else {
    writeJson(path.join('.vscode', 'settings.baseline.json'), desired);
    note('MANUAL: .vscode/settings.json contains comments; merge .vscode/settings.baseline.json by hand and delete it');
  }
} else {
  writeJson(vsSettings, desired);
  note('created .vscode/settings.json');
}

// ---------------------------------------------------------------- VS Code extensions
const recs = ['EditorConfig.EditorConfig'];
if (ts) recs.push('dbaeumer.vscode-eslint', 'esbenp.prettier-vscode');
if (angular) recs.push('Angular.ng-template', 'deque-systems.vscode-axe-linter');
if (react) recs.push('deque-systems.vscode-axe-linter'); // React and Next.js support is built into VS Code and IntelliJ
if (vitest) recs.push('vitest.explorer');
if (playwright) recs.push('ms-playwright.playwright');
if (java) recs.push('vscjava.vscode-java-pack');
if (spring) recs.push('vmware.vscode-boot-dev-pack');
if (openapi) recs.push('42Crunch.vscode-openapi', 'redhat.vscode-yaml');
if (docker) recs.push('ms-azuretools.vscode-containers');
const vsExt = path.join('.vscode', 'extensions.json');
const currentExt = fs.existsSync(vsExt) ? readJsonSafe(vsExt) : undefined;
if (currentExt !== undefined) {
  currentExt.recommendations = [...new Set([...(currentExt.recommendations ?? []), ...recs])].sort();
  writeJson(vsExt, currentExt);
  note('merged .vscode/extensions.json');
} else if (fs.existsSync(vsExt)) {
  note(`MANUAL: .vscode/extensions.json contains comments; add: ${recs.join(' ')}`);
} else {
  writeJson(vsExt, { recommendations: [...new Set(recs)] });
  note('created .vscode/extensions.json');
}

// ---------------------------------------------------------------- IntelliJ IDEA Ultimate
fs.mkdirSync('.idea', { recursive: true });
const writeIfMissing = (template, target) => {
  if (fs.existsSync(target)) {
    if (!fs.readFileSync(template).equals(fs.readFileSync(target))) {
      fs.copyFileSync(template, `${target}.baseline`);
      note(`MANUAL: ${target} differs from baseline; compare with ${target}.baseline`);
    }
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(template, target);
    note(`created ${target}`);
  }
};

const plugins = [];
if (ts) {
  writeIfMissing(tplPath('idea-prettier.xml'), '.idea/prettier.xml');
  writeIfMissing(tplPath('idea-eslint.xml'), '.idea/jsLinters/eslint.xml');
  plugins.push('intellij.prettierJS');
}
if (angular) plugins.push('AngularJS');
if (jformat === 'google') {
  plugins.push('google-java-format');
  writeIfMissing(tplPath('idea-google-java-format.xml'), '.idea/google-java-format.xml');
} else if (jformat === 'palantir') {
  plugins.push('palantir-java-format');
  writeIfMissing(tplPath('idea-palantir-java-format.xml'), '.idea/palantir-java-format.xml');
}

if (plugins.length > 0) {
  const ext = '.idea/externalDependencies.xml';
  if (!fs.existsSync(ext)) {
    fs.writeFileSync(ext, [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<project version="4">',
      '  <component name="ExternalDependencies">',
      ...plugins.map((p) => `    <plugin id="${p}" />`),
      '  </component>',
      '</project>',
      '',
    ].join('\n'));
    note(`created ${ext} (${plugins.join(' ')})`);
  } else {
    let xml = read(ext);
    for (const p of plugins) {
      if (!xml.includes(`id="${p}"`)) {
        xml = xml.replaceAll('</component>', `  <plugin id="${p}" />\n  </component>`);
        note(`added required plugin ${p} to ${ext}`);
      }
    }
    fs.writeFileSync(ext, xml);
  }
}

// ---------------------------------------------------------------- .gitignore
const gitignore = fs.existsSync('.gitignore') ? read('.gitignore') : '';
if (!gitignore.includes('baseline-ide-setup:start')) {
  fs.appendFileSync('.gitignore', `\n${read(tplPath('gitignore-ide.txt'))}`);
  note('appended IDE block to .gitignore (check for older .idea/.vscode rules that contradict it)');
}

// ---------------------------------------------------------------- report
console.log('\nChanges:');
for (const r of report) console.log(`  - ${r}`);
console.log('\nOne-time per developer (IntelliJ stores these per user):');
if (ts) {
  const tsLib = tsDirs[0] !== '.' ? `${tsDirs[0]}/node_modules/typescript` : 'node_modules/typescript';
  console.log(`  - Settings > Languages & Frameworks > TypeScript: use ${tsLib}`);
}
if (java) {
  if (jformat === 'none') {
    console.log("  - Java: no shared formatter configured in the build (e.g. Spotless). Java format-on-save is OFF in VS Code;");
    console.log("    keep 'Reformat code' off for Java in IntelliJ until the project defines one.");
  } else {
    console.log("  - Settings > Tools > Actions on Save: enable 'Reformat code' and 'Optimize imports' for Java only");
  }
}
if (ts) console.log("  - Settings > Tools > Actions on Save: 'Run eslint --fix' and 'Run Prettier' are preconfigured; keep 'Optimize imports' OFF for TypeScript");

// ---------------------------------------------------------------- helpers
function read(f) { return fs.readFileSync(f, 'utf8'); }
function readJson(f) { return JSON.parse(read(f)); }
function readJsonSafe(f) { try { return JSON.parse(read(f)); } catch { return undefined; } }
function writeJson(f, v) { fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`); }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function isFile(p) { try { return fs.statSync(p).isFile(); } catch { return false; } }
function safeReaddir(d) { try { return fs.readdirSync(d); } catch { return []; } }

// jq's `a * b`: objects merge recursively, everything else from b wins.
function deepMerge(a, b) {
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(a) || !isObj(b)) return b;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? deepMerge(out[k], v) : v;
  return out;
}
