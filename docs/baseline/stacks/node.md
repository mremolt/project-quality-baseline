# Node.js

Rules for every Node.js backend, framework-independent. NestJS additions are in [stacks/nestjs.md](nestjs.md). They implement the shared docs and may tighten them, never contradict them. Defaults (`NODE-D*`): [04-solution-strategy/node.md](../04-solution-strategy/node.md).

**Agents:** start with the rule index ([shared](../rule-index/shared.md), [node](../rule-index/node.md)): every rule ID with its headline. Open the docs below only for the topics the task touches, never all at once (TOOL-SKL-10).

| Doc | Covers | Rule IDs |
|---|---|---|
| [05-building-block-view/node.md](../05-building-block-view/node.md) | Folder layout, core purity, commands, error classes, event loop, unhandled rejections, dependency-cruiser | `NODE-ARCH-*` |
| [08-crosscutting-concepts/development/node-tooling.md](../08-crosscutting-concepts/development/node-tooling.md) | Node version, tsconfig for Node, ESLint additions, npm scripts, production dependencies | `NODE-TOOL-*` |
| [08-crosscutting-concepts/development/typescript-tooling.md](../08-crosscutting-concepts/development/typescript-tooling.md) | ESLint base config, Prettier, npm supply chain (TS-TOOL-03..16) | `TS-TOOL-*` |

**Read only these from the TypeScript layer.** The other TypeScript docs (`05-building-block-view/typescript.md`, `testing/typescript*.md`, `api/typescript-openapi-clients.md`, `security/typescript.md`) are about frontends; a backend does not need them.

Configuration, observability, resilience, messaging, data protection and delivery have shared rules (`CFG-*`, `OBS-*`, `RES-*`, `MSG-*`, `DP-*`, `REL-*`) and NestJS implementations listed in [stacks/nestjs.md](nestjs.md).

## Skills for Node work

The `baseline-nestjs` skill loads these for you in NestJS projects:

| Skill | For |
|---|---|
| `baseline-tdd` (own) | Test-first workflow |
| `vitest` | Vitest APIs |

**Where a skill and these docs disagree, the docs win** (TOOL-SKL-01). Known conflicts: [stacks/nestjs.md](nestjs.md#skill-overrides).
