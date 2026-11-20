/** Architecture rules of a NestJS backend (NODE-ARCH-04, NEST-ARCH table). Patterns cover every context and src/platform. */
const ring = '^src/(features/[^/]+|platform)';
const test = '\\.test\\.ts$'; // tests of a ring may use the test libraries

module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    {
      name: 'domain-is-pure',
      severity: 'error',
      comment: 'NODE-ARCH-04: own domain and the platform domain entry only; no Nest, Fastify, node:*',
      from: { path: `${ring}/domain/`, pathNot: test },
      to: { pathNot: ['^src/$1/domain/', '^src/platform/domain/index\\.ts$'] },
    },
    {
      name: 'ports-only-domain',
      severity: 'error',
      from: { path: `${ring}/ports/`, pathNot: test },
      to: { pathNot: ['^src/$1/(domain|ports)/', '^src/platform/domain/index\\.ts$', 'node_modules/zod/'] },
    },
    {
      name: 'application-only-core',
      severity: 'error',
      comment: 'Allow-list for application (ARCH-DEP-03): own rings, platform domain, zod',
      from: { path: `${ring}/application/`, pathNot: test },
      to: { pathNot: ['^src/$1/(domain|ports|application)/', '^src/platform/domain/index\\.ts$', 'node_modules/zod/'] },
    },
    {
      name: 'adapters-use-ports-not-services',
      severity: 'error',
      from: { path: `${ring}/adapter/` },
      to: { path: '^src/(features/[^/]+|platform)/application/' },
    },
    {
      name: 'adapters-are-independent',
      severity: 'error',
      comment:
        'ARCH-DEP-05: one adapter/<direction>/<technology> folder never imports another; platform adapters are shared',
      from: { path: `${ring}/adapter/(in|out)/([^/]+)/` },
      to: { path: '/adapter/(in|out)/[^/]+/', pathNot: ['^src/$1/adapter/$2/$3/', '^src/platform/adapter/'] },
    },
    {
      name: 'features-only-via-index',
      severity: 'error',
      from: { path: '^src/features/([^/]+)/' },
      to: { path: '^src/features/[^/]+/', pathNot: ['^src/features/$1/', '^src/features/[^/]+/index\\.ts$'] },
    },
    {
      name: 'platform-no-features',
      severity: 'error',
      from: { path: '^src/platform/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'tokens-only-ports',
      severity: 'error',
      from: { path: `${ring}/[^/]+\\.tokens\\.ts$` },
      to: { path: '^src/', pathNot: ['^src/$1/ports/', '^src/platform/domain/index\\.ts$'] },
    },
    {
      name: 'feature-module-only-from-app-module',
      severity: 'error',
      comment:
        'NEST-ARCH-01: the context module is the composition root; only app.module and the context index import it',
      from: { pathNot: ['^src/app\\.module\\.ts$', '^src/features/[^/]+/index\\.ts$', test] },
      to: { path: '^src/features/[^/]+/[^/]+\\.module\\.ts$' },
    },
    {
      name: 'db-client-only-in-persistence-adapter',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: [
          '/adapter/out/persistence/',
          '/adapter/in/scheduling/',
          '/adapter/in/health/',
          '\\.module\\.ts$',
          test,
        ],
      },
      to: { path: 'node_modules/(kysely|pg)/' },
    },
    {
      name: 'kysely-token-only-in-persistence',
      severity: 'error',
      comment:
        'NEST-DB: the Kysely instance is injected only by persistence adapters, scheduling (cluster lock), the readiness check and the composition',
      from: {
        path: '^src/',
        pathNot: [
          '/adapter/out/persistence/',
          '/adapter/in/scheduling/',
          '^src/platform/adapter/in/health/',
          '\\.module\\.ts$',
          '^src/(main|migrate)\\.ts$',
          test,
        ],
      },
      to: { path: '^src/platform/adapter/out/persistence/database\\.ts$' },
    },
    {
      name: 'kafka-client-only-in-messaging-adapter',
      severity: 'error',
      comment: 'NEST-MSG: the Kafka client stays in messaging adapters',
      from: { path: '^src/', pathNot: ['/adapter/(in|out)/messaging/', '\\.module\\.ts$', test] },
      to: { path: 'node_modules/@platformatic/kafka/' },
    },
    {
      name: 'generated-api-only-in-http-adapter',
      severity: 'error',
      from: { pathNot: '/adapter/out/http/' },
      to: { path: '/adapter/out/http/generated/' },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    // ESM-only packages (e.g. @platformatic/kafka) resolve only through their exports map; without this a rule on them checks nothing
    enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'types'] },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '^(dist|test/fixtures)/' },
  },
};
