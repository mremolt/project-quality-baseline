#!/usr/bin/env node
// Scaffolds a frontend feature in the ring layout of NG-ARCH-01/23: `npm run new:feature -- <kebab-name>`.
// Copy to `frontend/scripts/new-feature.mjs` and add `"new:feature": "node scripts/new-feature.mjs"` to package.json.
// Creates tokens, providers, routes, index, one lazy page with template/styles/spec and the de/en catalogs with
// context.json, so a new feature starts compliant (TS-ARCH-09/17/20, NG-ARCH-21/22, NG-I18N-02/03/13).
// Expects the helpers `@testing/axe` (expectNoAxeViolations, TS-TEST-09) and `@testing/transloco`
// (provideTestTranslations); adapt LANGS and the page template to the product's shell.
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const name = process.argv[2];
if (!name || !/^[a-z][a-z0-9-]*$/u.test(name)) {
  console.error('Usage: npm run new:feature -- <kebab-case-name>');
  process.exit(1);
}
const camel = name.replace(/-([a-z0-9])/gu, (_, c) => c.toUpperCase());
const pascal = camel[0].toUpperCase() + camel.slice(1);
const root = join('src', 'features', name);
if (existsSync(root)) {
  console.error(`${root} exists already`);
  process.exit(1);
}
for (const dir of ['domain', 'application', 'ports/in', 'ports/out', 'adapter/in/ui/i18n', 'adapter/out/http']) {
  mkdirSync(join(root, dir), { recursive: true });
}
const write = (file, content) => writeFileSync(join(root, file), content);

write(
  `${name}.tokens.ts`,
  `// Injection tokens of the ports and use-case contracts (TS-ARCH-17); import only ports here.\nexport {};\n`,
);
write(
  `${name}.providers.ts`,
  `import type { Provider } from '@angular/core';\n\n/** Composition root of the feature (TS-ARCH-09), attached at route level (NG-ARCH-11). */\nexport const ${camel}Providers: Provider[] = [];\n`,
);
write(
  `${name}.routes.ts`,
  `import type { Routes } from '@angular/router';\nimport { provideTranslocoScope } from '@jsverse/transloco';\n\nimport { ${camel}Providers } from './${name}.providers';\n\nexport const ${pascal.toUpperCase()}_ROUTES: Routes = [\n  {\n    path: '',\n    providers: [\n      ...${camel}Providers,\n      provideTranslocoScope({\n        scope: '${camel}',\n        loader: { en: () => import('./adapter/in/ui/i18n/en.json'), de: () => import('./adapter/in/ui/i18n/de.json') },\n      }),\n    ],\n    children: [\n      {\n        path: '',\n        title: 'shell.title.${camel}', // route titles live in the shell catalog: add the key there\n        loadComponent: () => import('./adapter/in/ui/${name}-page').then((m) => m.${pascal}Page),\n      },\n    ],\n  },\n];\n`,
);
write(
  'index.ts',
  `// Public API of the feature (TS-ARCH-19): contracts, their tokens, provide${pascal}Api(). Never routes (TS-ARCH-20).\nexport {};\n`,
);
write(
  `adapter/in/ui/${name}-page.ts`,
  `import { ChangeDetectionStrategy, Component } from '@angular/core';\nimport { TranslocoPipe } from '@jsverse/transloco';\n\n@Component({\n  selector: 'app-${name}-page',\n  imports: [TranslocoPipe],\n  templateUrl: './${name}-page.html',\n  styleUrl: './${name}-page.scss',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n})\nexport class ${pascal}Page {}\n`,
);
write(`adapter/in/ui/${name}-page.html`, `<h1>{{ '${camel}.page.heading' | transloco }}</h1>\n`);
write(`adapter/in/ui/${name}-page.scss`, `:host {\n  display: block;\n}\n`);
write(
  `adapter/in/ui/${name}-page.spec.ts`,
  `import { render, screen } from '@testing-library/angular';\nimport { describe, expect, it } from 'vitest';\n\nimport { expectNoAxeViolations } from '@testing/axe';\nimport { provideTestTranslations } from '@testing/transloco';\n\nimport { ${pascal}Page } from './${name}-page';\n\ndescribe('${pascal}Page', () => {\n  it('renders its heading without accessibility violations', async () => {\n    const { container } = await render(${pascal}Page, { providers: provideTestTranslations() });\n\n    expect(await screen.findByRole('heading', { name: '${pascal}' })).toBeTruthy();\n    await expectNoAxeViolations(container);\n  });\n});\n`,
);
const catalog = (heading) => JSON.stringify({ page: { heading } }, null, 2) + '\n';
write('adapter/in/ui/i18n/en.json', catalog(pascal));
write('adapter/in/ui/i18n/de.json', catalog(pascal));
write(
  'adapter/in/ui/i18n/context.json',
  JSON.stringify({ [`${camel}.page.heading`]: { description: `Heading of the ${name} page` } }, null, 2) + '\n',
);
console.log(
  `Created ${root}. Next: add shell.title.${camel} to the shell catalogs, register the route in app.routes.ts,`,
);
console.log(`add '${camel}' catalog to src/testing/transloco.ts, then write the use cases test-first.`);
