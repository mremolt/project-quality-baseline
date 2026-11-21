/** Architecture rules (TS-ARCH-12): the neutral template with the Next.js constants, changes and rules (NEXT-ARCH-13). */
const COMPOSITION_FILE = '\\.composition(\\.server)?\\.tsx?$';
const ROOT_HTTP_SETUP = '^src/app/providers\\.tsx?$';
const HTTP_CLIENT_MODULES = 'node_modules/(axios|ky|undici)/';
const TEST_FILE = '\\.(spec|test)\\.tsx?$';
const STORE_FILE = '\\.slice\\.tsx?$';
const PAGES_FILE = '^src/features/[^/]+/[^/]+\\.pages\\.tsx?$';
const SERVER_ACTIONS = '/adapter/in/next/[^/]+-actions\\.ts$';
const HTTP_MUTATOR = '^src/platform/adapter/out/http/(browser|server)-fetch\\.ts$'; // imported by Orval output only
const FEATURE_API_FILE = '^src/features/[^/]+/[^/]+\\.api\\.tsx$'; // the published feature API (REACT-ARCH-11)
const CLIENT_FILE = [
  '\\.client\\.tsx?$',
  '\\.composition\\.tsx$',
  FEATURE_API_FILE,
  '^src/app/(providers|app-shell|theme)\\.tsx?$',
];
const SERVER_ONLY = ['\\.server\\.tsx?$', 'node_modules/server-only/', 'node_modules/next/dist/[^/]+/headers'];
const ROUTE_NAMES = '(page|layout|route|loading|error|not-found|template|default)\\.tsx?$';
const ROUTE_FILE = [`^src/app/${ROUTE_NAMES}`, `^src/app/.*/${ROUTE_NAMES}`]; // one pattern with (.+/)? is rejected as unsafe

module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'TS-ARCH-01: domain imports only its own domain and the platform domain entry',
      from: { path: '^src/(features/[^/]+|platform)/domain/', pathNot: TEST_FILE },
      to: { pathNot: ['^src/$1/domain/', '^src/platform/domain/index\\.ts$'] },
    },
    {
      name: 'ports-only-domain',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|platform)/ports/', pathNot: TEST_FILE },
      to: { pathNot: ['^src/$1/(domain|ports)/', '^src/platform/domain/index\\.ts$', 'node_modules/(zod|rxjs)/'] },
    },
    {
      name: 'application-only-core',
      severity: 'error',
      comment: 'TS-ARCH-01 as an allow-list; add node_modules/rxjs/ only for features with stream use cases (TS-D1)',
      from: { path: '^src/(features/[^/]+|platform)/application/', pathNot: TEST_FILE },
      to: {
        pathNot: ['^src/$1/(domain|ports|application)/', '^src/platform/domain/index\\.ts$', 'node_modules/zod/'],
      },
    },
    {
      name: 'adapters-use-ports-not-services',
      severity: 'error',
      from: { path: '^src/(features/[^/]+|platform)/adapter/' },
      to: { path: '^src/$1/application/' },
    },
    {
      name: 'ui-and-http-adapters-independent',
      severity: 'error',
      from: { path: '/adapter/in/' },
      to: { path: '/adapter/out/' },
    },
    {
      name: 'ui-no-outgoing-ports',
      severity: 'error',
      comment: 'TS-ARCH-08: the UI reaches the core only through ports/in',
      from: { path: '/adapter/in/' },
      to: { path: '/ports/out/' },
    },
    {
      name: 'stores-only-call-use-cases',
      severity: 'error',
      comment: 'TS-ARCH-03: no HTTP, no adapters, no services, no outgoing ports, no generated code, no other store',
      from: { path: STORE_FILE },
      to: { path: ['/adapter/out/', '/application/', '/ports/out/', '/generated/', STORE_FILE, HTTP_CLIENT_MODULES] },
    },
    {
      name: 'features-only-via-index',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/[^/]+/',
        pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'platform-only-via-index',
      severity: 'error',
      comment:
        'Next.js: three entries, index.ts (universal), index.client.ts (React context, Redux) and index.server.ts (server-only); a feature core may import only the platform domain entry',
      from: { path: '^src/(features|app|shared|testing)/' },
      to: {
        path: '^src/platform/',
        pathNot: [
          '^src/platform/index(\\.client|\\.server)?\\.ts$',
          '^src/platform/domain/index\\.ts$',
          '^src/platform/adapter/out/http/[^/]+/generated/',
          HTTP_MUTATOR,
        ],
      },
    },
    {
      name: 'http-mutator-only-from-generated',
      severity: 'error',
      comment: 'TS-API-03: generated clients call the mutators; the platform composition configures the server mutator',
      from: { pathNot: ['/adapter/out/http/generated/', '^src/platform/'] },
      to: { path: HTTP_MUTATOR },
    },
    {
      name: 'app-uses-features-via-index-or-pages',
      severity: 'error',
      comment: 'TS-ARCH-10/20: the root files of src/app see a feature only through its public API and its pages file',
      from: { path: '^src/app/' },
      to: { path: '^src/features/[^/]+/', pathNot: ['^src/features/[^/]+/index\\.ts$', PAGES_FILE] },
    },
    {
      name: 'platform-no-features',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'feature-pages-only-from-app',
      severity: 'error',
      comment:
        'TS-ARCH-20 for Next.js: only the app route files import a feature pages file; the App Router splits per route',
      from: { pathNot: ['^src/app/', TEST_FILE] },
      to: { path: PAGES_FILE },
    },
    {
      name: 'generated-api-only-in-http-adapter',
      severity: 'error',
      comment: 'Orval output is confined to adapter/out/http (API-CON-09, TS-ARCH-05)',
      from: { pathNot: '/adapter/out/http/' },
      to: { path: '/adapter/out/http/generated/' },
    },
    {
      name: 'http-clients-only-in-http-adapter',
      severity: 'error',
      comment: 'TS-ARCH-04; the root HTTP setup and feature composition files may configure the HTTP stack',
      from: {
        path: '^src/',
        pathNot: ['/adapter/out/http/', '^src/platform/adapter/', COMPOSITION_FILE, FEATURE_API_FILE, ROOT_HTTP_SETUP],
      },
      to: { path: HTTP_CLIENT_MODULES },
    },
    {
      name: 'tokens-only-ports',
      severity: 'error',
      comment: 'TS-ARCH-17: the tokens file imports only its own ports (and the framework)',
      from: { path: '^src/(features/[^/]+|platform)/[^/]+\\.tokens\\.tsx?$' },
      to: { path: '^src/', pathNot: ['^src/$1/ports/', '^src/platform/domain/index\\.ts$'] },
    },
    {
      name: 'composition-root-not-imported',
      severity: 'error',
      comment:
        'TS-ARCH-17/19: only pages, the root composition, the feature index (API provider), the platform server entry and server actions import a composition file; server actions have no other way to reach the server use cases',
      from: {
        pathNot: [
          PAGES_FILE,
          '^src/app/',
          '^src/features/[^/]+/index\\.ts$',
          '^src/platform/index\\.server\\.ts$',
          SERVER_ACTIONS,
        ],
      },
      to: { path: COMPOSITION_FILE },
    },
    {
      name: 'feature-api-without-ui',
      severity: 'error',
      comment:
        'REACT-ARCH-11: the published API imports adapters, use cases and the context only; never UI components or the slice, which would load for every consumer',
      from: { path: FEATURE_API_FILE },
      to: { path: ['/adapter/in/ui/', STORE_FILE, COMPOSITION_FILE] },
    },
    {
      name: 'shared-ui-no-features',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/features/' },
    },
    // Next.js rules
    {
      name: 'client-never-imports-server-only',
      severity: 'error',
      comment:
        "Client files (*.client.tsx, the client composition, the root client providers) never import server-only modules. Only file names are visible: dependency-cruiser cannot read the 'use client' directive",
      from: { path: CLIENT_FILE },
      to: { path: SERVER_ONLY },
    },
    {
      name: 'client-uses-client-platform-entry',
      severity: 'error',
      comment: 'Client files use src/platform/index.ts, never the server entry',
      from: { path: CLIENT_FILE },
      to: { path: '^src/platform/index\\.server\\.ts$' },
    },
    {
      name: 'server-never-imports-client-entry',
      severity: 'error',
      comment:
        'Server components and server modules never import the client platform entry: Redux and React context fail in the react-server build',
      from: { path: ['\\.server\\.tsx?$', SERVER_ACTIONS, PAGES_FILE] },
      to: { path: '^src/platform/index\\.client\\.ts$' },
    },
    {
      name: 'app-route-files-are-thin',
      severity: 'error',
      comment:
        'page/layout/route files render a feature page or bind a platform handler: no logic, no fetch, no generated client',
      from: { path: ROUTE_FILE },
      to: {
        pathNot: [
          PAGES_FILE,
          '^src/features/[^/]+/index\\.ts$',
          '^src/platform/index(\\.client|\\.server)?\\.ts$',
          '^src/app/[^/]+\\.tsx?$',
          'node_modules/(next|react|next-intl)/',
          'node_modules/@types/react/',
        ],
      },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true, // also see imports that vanish at compile time (import type, interfaces)
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types', 'default'] },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(\\.next|test/fixtures)/' },
  },
};
