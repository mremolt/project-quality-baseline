// TS-ARCH-12 template with the React SPA constants and additions (TanStack Router routes, Orval mutator, RTK slices)
const COMPOSITION_FILE = '\\.composition\\.tsx?$';
const ROOT_HTTP_SETUP = '^src/platform/platform\\.composition\\.tsx$'; // configureHttp() runs in the platform composition
const HTTP_CLIENT_MODULES = 'node_modules/(axios|ky)'; // fetch is a global: ESLint no-restricted-globals covers it
const STORE_FILE = '\\.slice\\.tsx?$'; // Redux Toolkit slices are the view-state stores
const ROUTES_FILE = '^src/features/[^/]+/[^/]+\\.routes\\.tsx?$';
const HTTP_MUTATOR = '^src/platform/adapter/out/http/custom-fetch\\.ts$'; // imported by Orval output only
const TEST_FILE = '\\.(spec|test)\\.tsx?$'; // colocated tests import vitest: excluded from the core allow-lists
const ROUTES_STATIC_ALLOWED = 'node_modules/(@tanstack/react-router|zod|react)/';

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
      comment: 'TS-ARCH-01 as an allow-list',
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
      name: 'app-uses-features-via-index-or-routes',
      severity: 'error',
      comment: 'TS-ARCH-10/20: the app shell sees a feature only through its public API and its routes file',
      from: { path: '^src/app/' },
      to: { path: '^src/features/[^/]+/', pathNot: ['^src/features/[^/]+/index\\.ts$', ROUTES_FILE] },
    },
    {
      name: 'platform-only-via-index',
      severity: 'error',
      comment:
        'src/platform is treated like a feature; a feature core may import only the platform domain entry (TS-ARCH-01); the Orval mutator is reached by generated code (http-mutator-only-from-generated)',
      from: { path: '^src/(features|app|shared)/' },
      to: {
        path: '^src/platform/',
        pathNot: [
          '^src/platform/index\\.ts$',
          '^src/platform/domain/index\\.ts$',
          '^src/platform/adapter/out/http/[^/]+/generated/',
          HTTP_MUTATOR,
        ],
      },
    },
    {
      name: 'http-mutator-only-from-generated',
      severity: 'error',
      comment: 'TS-API-03: generated clients call the mutator; everything else goes through ports',
      from: { pathNot: ['/adapter/out/http/generated/', '^src/platform/'] },
      to: { path: HTTP_MUTATOR },
    },
    {
      name: 'platform-no-features',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'feature-routes-only-from-app',
      severity: 'error',
      comment: 'TS-ARCH-20: only the app routes load feature routes',
      from: { pathNot: ['^src/app/', TEST_FILE] },
      to: { path: ROUTES_FILE },
    },
    {
      name: 'feature-routes-load-feature-lazily',
      severity: 'error',
      comment:
        'TS-ARCH-20 (TanStack Router, code-based): the app imports the routes file statically for the typed route tree, so the routes file itself imports only the router, zod and react statically; page, slice, adapters and composition only through import()',
      from: { path: ROUTES_FILE },
      to: { dependencyTypesNot: ['dynamic-import'], pathNot: ROUTES_STATIC_ALLOWED },
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
        pathNot: ['/adapter/out/http/', '^src/platform/adapter/', COMPOSITION_FILE, ROOT_HTTP_SETUP],
      },
      to: { path: HTTP_CLIENT_MODULES },
    },
    {
      name: 'tokens-only-ports',
      severity: 'error',
      comment: 'TS-ARCH-17: the tokens file imports only its own ports (and react)',
      from: { path: '^src/(features/[^/]+|platform)/[^/]+\\.tokens\\.tsx?$' },
      to: { path: '^src/', pathNot: ['^src/$1/ports/', '^src/platform/domain/index\\.ts$'] },
    },
    {
      name: 'composition-root-not-imported',
      severity: 'error',
      comment:
        'TS-ARCH-17/19: only routes (dynamically), the root composition and the public index import the composition file',
      from: { pathNot: ['\\.routes\\.tsx?$', '^src/app/', '^src/(features/[^/]+|platform)/index\\.ts$'] },
      to: { path: COMPOSITION_FILE },
    },
    {
      name: 'shared-ui-no-features',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/features/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true, // also see imports that vanish at compile time (import type, interfaces)
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types'] },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^test/fixtures/' },
  },
};
