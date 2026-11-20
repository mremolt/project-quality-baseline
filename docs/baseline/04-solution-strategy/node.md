# Solution Strategy: Node.js

The key technology decisions for Node.js backend components, independent of the framework. They tighten the shared strategy in [04-solution-strategy/README.md](README.md) and never contradict it. NestJS additions: [04-solution-strategy/nestjs.md](nestjs.md). Navigation and skills: [stacks/node.md](../stacks/node.md).

## Defaults

| # | Topic | Default | Defined in |
|---|---|---|---|
| NODE-D1 | Runtime | Node.js Active LTS (26 "Lithium" since 2026-10-28), pinned in `.nvmrc`; npm 11.10 or newer | [08-crosscutting-concepts/development/node-tooling.md](../08-crosscutting-concepts/development/node-tooling.md) |
| NODE-D2 | Language and modules | TypeScript, ES modules (`"type": "module"`, `module: nodenext`), compiled with `tsc` to `dist/`, run with `node dist/main.js`; no runtime transpilers (`ts-node`, `tsx`) in production | [node-tooling.md](../08-crosscutting-concepts/development/node-tooling.md) |
| NODE-D3 | Concurrency | One event loop per process; no blocking work on it; CPU-heavy work in worker threads; scale out with instances, not with `cluster` | [05-building-block-view/node.md](../05-building-block-view/node.md) |
| NODE-D4 | Async in ports | `Promise` (optional `AbortSignal`); `AsyncIterable` only for real streams (same as TS-D1) | [05-building-block-view/node.md](../05-building-block-view/node.md) |
| NODE-D5 | Schemas | zod 4 for commands, request/response schemas, configuration and message payloads (TS-D2) | [05-building-block-view/node.md](../05-building-block-view/node.md) |
| NODE-D6 | Quality tools | Compiler, ESLint, Prettier and supply-chain rules of [typescript-tooling.md](../08-crosscutting-concepts/development/typescript-tooling.md) (TS-D4, TS-D5), with the Node settings of NODE-TOOL | [node-tooling.md](../08-crosscutting-concepts/development/node-tooling.md) |
| NODE-D7 | Tests | Vitest + vitest-mock-extended; Testcontainers for adapters; no in-memory stand-ins for the database or broker | [08-crosscutting-concepts/testing/nestjs.md](../08-crosscutting-concepts/testing/nestjs.md) |
| NODE-D8 | Architecture tests | dependency-cruiser with `tsPreCompilationDeps: true` from day one (D4) | [05-building-block-view/node.md](../05-building-block-view/node.md) |
