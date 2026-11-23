# TypeScript

Rules for every TypeScript frontend, framework-independent. Each frontend stack adds its own page (Angular: [stacks/angular.md](angular.md); React SPA: [stacks/react.md](react.md); Next.js: [stacks/react.md](react.md) + [stacks/nextjs.md](nextjs.md)) and never needs another frontend stack's docs. Node.js backends use only [typescript-tooling.md](../08-crosscutting-concepts/development/typescript-tooling.md) from this page, through [stacks/node.md](node.md). Defaults (`TS-D*`): [04-solution-strategy/typescript.md](../04-solution-strategy/typescript.md).

**Agents:** start with the rule index ([shared](../rule-index/shared.md), [typescript](../rule-index/typescript.md)): every rule ID with its headline. Open the docs below only for the topics the task touches, never all at once (TOOL-SKL-10).

| Doc | Covers | Rule IDs |
|---|---|---|
| [05-building-block-view/typescript.md](../05-building-block-view/typescript.md) | Hexagonal architecture in frontends, folder layout, dependency-cruiser, error mapping, feature boundaries, superseded loads, the platform clock and business date, expected errors | `TS-ARCH-*` |
| [08-crosscutting-concepts/development/typescript-tooling.md](../08-crosscutting-concepts/development/typescript-tooling.md) | Supported browsers and `lib`, tsconfig, ESLint, Prettier, npm scripts, E2E type-check and lint, wall-clock ban, npm version, update automation, reproducible builds and SBOM | `TS-TOOL-*` |
| [08-crosscutting-concepts/testing/typescript.md](../08-crosscutting-concepts/testing/typescript.md) | Vitest, vitest-mock-extended, Testing Library, MSW, Playwright basics and tiers, axe | `TS-TEST-01..16, 34, 35` |
| [08-crosscutting-concepts/testing/typescript-e2e.md](../08-crosscutting-concepts/testing/typescript-e2e.md) | Playwright matrix, viewports, themes, responsive, screen reader assertions, flaky tests, time budget, failing on unstubbed calls and page errors | `TS-TEST-17..33` |
| [08-crosscutting-concepts/security/typescript.md](../08-crosscutting-concepts/security/typescript.md) | Browser storage, DOM and eval bans, redirects, bundle secrets, source maps, third-party scripts; npm supply chain in tooling | `TS-SEC-*`, `TS-TOOL-11..16` |
| [08-crosscutting-concepts/api/typescript-openapi-clients.md](../08-crosscutting-concepts/api/typescript-openapi-clients.md) | Generated API clients with Orval: placement, validation, mocks, N+1 helpers | `TS-API-*` |
| [08-crosscutting-concepts/ui/ui-patterns.md](../08-crosscutting-concepts/ui/ui-patterns.md) | Window size classes, navigation by size, responsive layout, status messages, route title and focus, dialogs, loading/empty/error states | `UI-*` |

Shared docs every TypeScript frontend also implements (the stack page lists its implementation of each):

| Doc | Covers | Rule IDs |
|---|---|---|
| [08-crosscutting-concepts/api/rest-conventions.md](../08-crosscutting-concepts/api/rest-conventions.md) | Wire format the clients consume: decimals, dates, enums, problem `code`s, paging, sorting, filtering | `API-REST-*` |
| [07-deployment-view/container-runtime.md](../07-deployment-view/container-runtime.md) | Frontend delivery: the BFF image embeds and serves the bundle, caching, rolling deployments, one release tag | `REL-FE-*` |
| [08-crosscutting-concepts/configuration/configuration.md](../08-crosscutting-concepts/configuration/configuration.md) | One build for all environments, runtime configuration, secrets | `CFG-*` |
| [08-crosscutting-concepts/observability/observability.md](../08-crosscutting-concepts/observability/observability.md) | Frontend error reports, correlation, source maps | `OBS-*` |
| [10-quality-requirements/accessibility.md](../10-quality-requirements/accessibility.md) | WCAG 2.2 AA target, adopted AAA set, test layers L1–L6, journey and screen inventory | `A11Y-*` |
| [08-crosscutting-concepts/data-protection/data-protection.md](../08-crosscutting-concepts/data-protection/data-protection.md) | Personal data, no third-party browser resources (DP-PROC-03) | `DP-*` |

