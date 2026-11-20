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
| TypeScript | [typescript.md](typescript.md): hexagonal frontends, folder layout, dependency-cruiser | `TS-ARCH-*` |
| Angular | [angular.md](angular.md): project layout, naming, DI and wiring, HTTP, routing, forms, setup | `NG-ARCH-*` |
