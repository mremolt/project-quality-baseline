# 5. Building Block View

The static structure every product uses: rings, packages and folders, and the kinds of building blocks inside them. A product's chapter 5 shows its concrete building blocks (bounded contexts, features, adapters) in this structure.

## Generic

| Doc | Covers | Rule IDs |
|---|---|---|
| [code-organization.md](code-organization.md) | Reference folder/package layout, allowed dependencies, bounded contexts | `ARCH-ORG-*` |
| [use-cases.md](use-cases.md) | Use-case slicing and naming, commands/results, validation placement, error categories, domain events, authorization, transactions, domain model style | `ARCH-UC-*` |
| [adapters.md](adapters.md) | Incoming and outgoing adapters, narrow ports, error translation | `ARCH-ADP-*` |

## Per stack

| Stack | Doc | Rule IDs |
|---|---|---|
| Java | [java.md](java.md): package layout, visibility, records, ArchUnit, build modules | `JAVA-ARCH-*` |
| Spring Boot | [spring.md](spring.md): package structure, wiring, transactions, persistence mapping, messaging, ArchUnit template, new service | `SPRING-ARCH-*` |
| Node.js | [node.md](node.md): backend folder layout, core purity, commands, error classes, event loop, dependency-cruiser | `NODE-ARCH-*` |
| NestJS | [nestjs.md](nestjs.md): modules as composition roots, tokens, wiring, transactions, dependency-cruiser template, new service | `NEST-ARCH-*` |
| TypeScript | [typescript.md](typescript.md): hexagonal frontends, folder layout, dependency-cruiser | `TS-ARCH-*` |
| Angular | [angular.md](angular.md): project layout, naming, DI and wiring, HTTP, routing, forms, setup | `NG-ARCH-*` |
| React | [react.md](react.md): layout, tokens and composition, hooks, data loading, forms, error boundaries, (React SPA) Vite, router, lazy routes, new app, dependency-cruiser | `REACT-ARCH-*` |
| Next.js | [nextjs.md](nextjs.md): `src/app/` as routing and root composition, server and client composition, server components, server actions, route handlers, `proxy.ts`, rendering default, new app | `NEXT-ARCH-*` |
