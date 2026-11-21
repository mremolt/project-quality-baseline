# Solution Strategy: React

The key technology decisions for React frontends. They tighten the shared strategy in [04-solution-strategy/README.md](README.md) and the TypeScript defaults in [typescript.md](typescript.md), and never contradict them. Navigation and skills for this stack: [stacks/react.md](../stacks/react.md).

The React stack has two forms. The **React SPA** (Vite, TanStack Router, static bundle served by the BFF) is the default. **Next.js** builds on this page and replaces the SPA-only defaults (marked "React SPA") for a stated reason ([nextjs.md](nextjs.md)). Choosing the React SPA as a product's frontend stack is recorded in the product's chapter 4; it needs no ADR.

## Stack at a glance

React 19.3 (function components, React Compiler 1.0) · Vite 8.3 with `@vitejs/plugin-react` 6.3 · TanStack Router 1.170 (code-based routes) · TanStack Query 5.107 (server state) · Redux Toolkit 2.14 + React Redux 9.3 (view state) · MUI 9.5 with Emotion 11.14 (CSS-variables theme) · React Hook Form 7.92 + `@hookform/resolvers` 7.0 · zod 4.6 · use-intl 4.15 · `@react-aria/live-announcer` 3.5 · Orval 8.47 (`fetch` client, zod schemas, MSW handlers) · MSW 3.0 · Vitest 5.1 + vitest-mock-extended 6.0 + Testing Library + jsdom 31 · Playwright 1.65 + axe-core 4.14 · ESLint 10.14 (typescript-eslint 8.72 type-checked, SonarJS, import-x, simple-import-sort, `eslint-plugin-react-hooks` 7.1, `@eslint-react` 5.30, `eslint-plugin-jsx-a11y-x` 0.2, `@tanstack/eslint-plugin-query` 5.107) · TypeScript 6.0 (typescript-eslint 8.72 requires `< 6.1`) · Prettier 3.10 · dependency-cruiser 18.7 · Node.js 26 and npm 11 for the toolchain.

Versions are major.minor of the validated setup; the exact pins live in the template `package.json` of the `baseline-react` skill.

## Defaults

| # | Topic | Default | Defined in |
|---|---|---|---|
| REACT-D1 | Build (React SPA) | Vite with `@vitejs/plugin-react`; React Compiler on (Babel preset through `@rolldown/plugin-babel`) | [05-building-block-view/react.md](../05-building-block-view/react.md) (REACT-ARCH-18) |
| REACT-D2 | Router (React SPA) | TanStack Router with code-based routes; no file-based routing; route definitions static, route components lazy | [05-building-block-view/react.md](../05-building-block-view/react.md) (REACT-ARCH-19..21) |
| REACT-D3 | View state | Redux Toolkit for view state that several components share: one app store, feature slices injected lazily; commands are TanStack Query mutations that call use cases; RTK Query is not used | [08-crosscutting-concepts/ui/react-state-management.md](../08-crosscutting-concepts/ui/react-state-management.md) |
| REACT-D4 | Server state | TanStack Query in the UI adapter; `queryFn` calls a use case; the cache holds domain types only | [05-building-block-view/react.md](../05-building-block-view/react.md) (REACT-ARCH-13), [react-state-management.md](../08-crosscutting-concepts/ui/react-state-management.md) |
| REACT-D5 | UI components | MUI with a CSS-variables theme (`cssVariables`, `colorSchemes`); React Aria Components only by ADR (own design system or strictest accessibility needs) | [08-crosscutting-concepts/ui/react-mui.md](../08-crosscutting-concepts/ui/react-mui.md) |
| REACT-D6 | Forms | React Hook Form with `standardSchemaResolver` and the command's zod schema from `ports/in` | [05-building-block-view/react.md](../05-building-block-view/react.md) (REACT-ARCH-14) |
| REACT-D7 | i18n | `use-intl` (React SPA); Next.js uses `next-intl` | [08-crosscutting-concepts/i18n/react.md](../08-crosscutting-concepts/i18n/react.md) |
| REACT-D8 | API clients | Orval `client: 'fetch'` with the platform mutator; Orval query-library clients (`react-query`, `swr`) are not used | [08-crosscutting-concepts/api/react-openapi-clients.md](../08-crosscutting-concepts/api/react-openapi-clients.md) |
| REACT-D9 | Delivery (React SPA) | Static bundle embedded in and served by the BFF (REL-FE-01..05 unchanged); `/config.json` from the BFF (CFG-11) | [08-crosscutting-concepts/configuration/react.md](../08-crosscutting-concepts/configuration/react.md), [container-runtime.md](../07-deployment-view/container-runtime.md) |
| REACT-D10 | Lint | The TS-TOOL-04 set plus `eslint-plugin-react-hooks` (`recommended-latest`, runs the React Compiler checks), `@eslint-react` (`strict-type-checked`), `eslint-plugin-jsx-a11y-x` (`strict`) and `@tanstack/eslint-plugin-query` (`recommended-strict`) | [08-crosscutting-concepts/development/react-tooling.md](../08-crosscutting-concepts/development/react-tooling.md) |

*Agent checklist in [checklists/react.md](../checklists/react.md) and sources in [sources.md](../sources.md), section "Solution Strategy: React".*
